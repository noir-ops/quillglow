# Curriculum Seeding

The Learning Graph and RAG are both **inert until a syllabus is seeded here**.
This is the long pole of the whole refactor, and it is *not* engineering work —
it's subject-expert work. Start it in parallel with everything else.

## Format

One JSON file per syllabus, in this directory. See `waec-mathematics.example.json`.

```jsonc
{
  "syllabus": "WAEC",
  "subject": "Mathematics",
  "topics": [
    {
      "name": "Algebraic Processes",
      "slug": "algebraic-processes",
      "concepts": [
        {
          "name": "Factorisation of quadratic expressions",
          "slug": "factorisation-quadratics",
          "difficulty": 0.5,           // 0..1, your best estimate; recalibrated from real attempts later
          "estimatedMinutes": 45,
          "prerequisites": ["expansion-brackets"],   // slugs of concepts that should come first
          "content": "Reference text indexed into RAG. Definitions, worked methods, common errors."
        }
      ]
    }
  ]
}
```

### Field notes

- **`slug`** must be unique within the syllabus. It's how prerequisites link, so
  keep it stable — renaming a slug breaks references.
- **`difficulty`** is a starting estimate. Exam Readiness™ weights by it, so
  rough is fine; it gets recalibrated from real attempt data.
- **`prerequisites`** are what let the Curriculum Agent avoid recommending a
  concept whose foundations aren't in place. Worth getting right.
- **`content`** is optional but is what makes RAG useful. Without it the concept
  exists in the graph but the tutor has nothing to ground answers in.

## Seeding

```bash
# preview without writing
npx tsx scripts/curriculum/seed.ts scripts/curriculum/waec-mathematics.json --dry-run

# write concepts + index content into RAG
npx tsx scripts/curriculum/seed.ts scripts/curriculum/waec-mathematics.json
```

Re-running is safe: concepts upsert on `(syllabus, slug)`, and RAG content is
checksum-deduped, so unchanged text isn't re-embedded (and isn't re-billed).

## Backfilling evidence collected before seeding

Events recorded before the curriculum existed carry `raw_topic` instead of
`concept_id`. Once seeded, map them and replay:

```sql
-- 1. See what students have actually been studying
select raw_topic, count(*) from learning_events
where concept_id is null and raw_topic is not null
group by raw_topic order by count desc limit 50;

-- 2. Map the ones that match
update learning_events e
set concept_id = c.id
from learning_concepts c
where e.concept_id is null
  and lower(e.raw_topic) = lower(c.name);

-- 3. Recompute mastery from the full history
select rebuild_mastery();
```

Every event collected in the meantime becomes usable retroactively. That's the
whole reason `concept_id` was made nullable.

## Scope advice

**One complete syllabus beats five partial ones.** Pick the one your first market
uses. A student needs full coverage of *their* exam for Exam Readiness™ to mean
anything — the score is scaled by syllabus coverage, so a half-seeded syllabus
produces permanently depressed scores.
