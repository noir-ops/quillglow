/**
 * Curriculum seeder.
 *
 * Loads a syllabus JSON file into `learning_concepts` and indexes each concept's
 * reference text into the RAG knowledge base.
 *
 *   npx tsx scripts/curriculum/seed.ts scripts/curriculum/waec-mathematics.json [--dry-run]
 *
 * Safe to re-run: concepts upsert on (syllabus, slug); RAG content is
 * checksum-deduped so unchanged text is not re-embedded or re-billed.
 */

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { indexSource } from "../../lib/ai/rag/indexer"

interface ConceptDef {
  name: string
  slug: string
  difficulty?: number
  estimatedMinutes?: number
  prerequisites?: string[]
  content?: string
}
interface TopicDef {
  name: string
  slug: string
  concepts: ConceptDef[]
}
interface SyllabusFile {
  syllabus: string
  subject: string
  topics: TopicDef[]
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

async function upsertConcept(row: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin
    .from("learning_concepts")
    .upsert(row, { onConflict: "syllabus,slug" })
    .select("id")
    .single()
  if (error) throw new Error(`upsert ${row.slug}: ${error.message}`)
  return data.id as string
}

async function main() {
  const file = process.argv[2]
  const dryRun = process.argv.includes("--dry-run")

  if (!file) {
    console.error("usage: seed.ts <syllabus.json> [--dry-run]")
    process.exit(1)
  }

  const spec: SyllabusFile = JSON.parse(readFileSync(file, "utf8"))
  const { syllabus, subject, topics } = spec

  const conceptCount = topics.reduce((n, t) => n + t.concepts.length, 0)
  console.log(`${syllabus} / ${subject}: ${topics.length} topics, ${conceptCount} concepts`)

  // Validate prerequisites before writing anything — a typo'd slug silently
  // breaks the Curriculum Agent's sequencing, so fail loudly here instead.
  const allSlugs = new Set(topics.flatMap((t) => t.concepts.map((c) => c.slug)))
  const badRefs: string[] = []
  for (const t of topics) {
    for (const c of t.concepts) {
      for (const p of c.prerequisites ?? []) {
        if (!allSlugs.has(p)) badRefs.push(`${c.slug} -> ${p}`)
      }
    }
  }
  if (badRefs.length) {
    console.error("Unknown prerequisite slugs:")
    badRefs.forEach((r) => console.error("  " + r))
    process.exit(1)
  }
  console.log("prerequisites: all resolve\n")

  if (dryRun) {
    for (const t of topics) {
      console.log(`  ${t.name}`)
      for (const c of t.concepts) {
        const rag = c.content ? `${c.content.length} chars -> RAG` : "no content"
        console.log(`    - ${c.name}  (difficulty ${c.difficulty ?? 0.5}, ${rag})`)
      }
    }
    console.log("\ndry run: nothing written")
    return
  }

  // Pass 1: subject + topics + concepts (prerequisites resolved in pass 2,
  // since a concept may reference one defined later in the file).
  const subjectId = await upsertConcept({
    syllabus, subject, name: subject, slug: `${syllabus}-${subject}`.toLowerCase().replace(/\s+/g, "-"),
    depth: 0, difficulty: 0.5,
  })

  const slugToId = new Map<string, string>()

  for (const topic of topics) {
    const topicId = await upsertConcept({
      parent_id: subjectId, syllabus, subject, name: topic.name, slug: topic.slug,
      depth: 1, difficulty: 0.5,
    })

    for (const c of topic.concepts) {
      const id = await upsertConcept({
        parent_id: topicId, syllabus, subject, name: c.name, slug: c.slug,
        depth: 2,
        difficulty: c.difficulty ?? 0.5,
        estimated_minutes: c.estimatedMinutes ?? null,
      })
      slugToId.set(c.slug, id)
    }
  }
  console.log(`concepts written: ${slugToId.size}`)

  // Pass 2: prerequisites, now that every slug has an id.
  let prereqCount = 0
  for (const topic of topics) {
    for (const c of topic.concepts) {
      const prereqs = (c.prerequisites ?? []).map((p) => slugToId.get(p)).filter(Boolean)
      if (!prereqs.length) continue
      const { error } = await admin
        .from("learning_concepts")
        .update({ prerequisites: prereqs })
        .eq("id", slugToId.get(c.slug)!)
      if (error) throw new Error(`prereqs ${c.slug}: ${error.message}`)
      prereqCount++
    }
  }
  console.log(`prerequisite links: ${prereqCount}`)

  // Pass 3: RAG indexing.
  const namespace = `syllabus_${syllabus.toLowerCase()}`
  let indexed = 0
  let skipped = 0
  let chunks = 0

  for (const topic of topics) {
    for (const c of topic.concepts) {
      if (!c.content?.trim()) continue
      try {
        const result = await indexSource({
          namespace,
          ownerId: null, // global reference content, readable by every student
          title: `${subject} — ${c.name}`,
          content: c.content,
          sourceType: "syllabus",
          conceptId: slugToId.get(c.slug) ?? null,
          metadata: { syllabus, subject, topic: topic.name, concept: c.name },
        })
        chunks += result.chunks
        result.skipped ? skipped++ : indexed++
      } catch (err) {
        console.error(`  index failed for ${c.slug}:`, err instanceof Error ? err.message : err)
      }
    }
  }

  console.log(`RAG: ${indexed} indexed, ${skipped} unchanged, ${chunks} chunks total`)
  console.log("\ndone")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
