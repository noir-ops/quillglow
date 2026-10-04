"use client"

import { useState } from "react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { ChevronDown, ChevronUp, Star } from "lucide-react"

export interface ParsedNoteSection {
  title: string
  keyPoints: string[]
  definitions: { term: string; definition: string }[]
  examTips: string[]
  mnemonics: string[]
}

/**
 * Reverses the flattening done in app/api/study-agent/export/route.ts —
 * that route turns { sections: [{ title, keyPoints, definitions, examTips,
 * mnemonics }] } into markdown so it's editable like any hand-written note.
 * This parses it back, so the SAME note can be displayed the way Study
 * Agent's own Notes tab shows it, rather than as raw "## " / "**bold**"
 * text in a plain textarea.
 *
 * Returns null for anything that doesn't match — freeform notes fall
 * through to plain markdown rendering instead, never to a broken parse.
 */
export function parseStructuredNote(content: string): ParsedNoteSection[] | null {
  if (!content || !content.includes("\n## ")) {
    // A note starting with a heading (no leading blank line) still counts.
    if (!content?.startsWith("## ")) return null
  }

  const blocks = content.split(/\n(?=## )/).filter((b) => b.trim().startsWith("## "))
  if (blocks.length === 0) return null

  const sections: ParsedNoteSection[] = []

  for (const block of blocks) {
    const lines = block.split("\n")
    const title = lines[0].replace(/^##\s*/, "").trim()
    if (!title) return null

    const section: ParsedNoteSection = { title, keyPoints: [], definitions: [], examTips: [], mnemonics: [] }
    let current: "keyPoints" | "definitions" | "examTips" | "mnemonics" | null = null

    for (const raw of lines.slice(1)) {
      const line = raw.trim()
      if (!line) continue

      if (/^\*\*key points\*\*$/i.test(line)) { current = "keyPoints"; continue }
      if (/^\*\*definitions\*\*$/i.test(line)) { current = "definitions"; continue }
      if (/^\*\*exam tips\*\*$/i.test(line)) { current = "examTips"; continue }
      if (/^\*\*mnemonics\*\*$/i.test(line)) { current = "mnemonics"; continue }

      if (!line.startsWith("-") || !current) continue
      const item = line.replace(/^-\s*/, "").trim()

      if (current === "definitions") {
        // "**term** — definition" (em dash) — exactly what the export writes.
        const m = item.match(/^\*\*(.+?)\*\*\s*[—-]\s*(.+)$/)
        if (m) section.definitions.push({ term: m[1].trim(), definition: m[2].trim() })
      } else {
        section[current].push(item)
      }
    }

    // A section with nothing recognisable in it isn't a real match — most
    // likely this content only coincidentally started with "## ".
    const hasContent =
      section.keyPoints.length || section.definitions.length || section.examTips.length || section.mnemonics.length
    if (!hasContent) return null

    sections.push(section)
  }

  return sections
}

/**
 * Read-only render matching Study Agent's own Notes tab styling exactly —
 * same section labels, same bullet/definition/exam-tip/mnemonic treatment —
 * so an exported note looks like where it came from, not like a text dump.
 */
export function NoteContentView({ content }: { content: string }) {
  const sections = parseStructuredNote(content)

  if (!sections) {
    // Not the Study Agent's shape — still render as markdown rather than
    // literal "**bold**" text, which is the general fix for messy display.
    return <ChatMarkdown content={content || ""} className="text-base sm:text-lg leading-relaxed" />
  }

  return <NoteSections sections={sections} />
}

export function NoteSections({ sections }: { sections: ParsedNoteSection[] }) {
  const [expanded, setExpanded] = useState<number | null>(0)

  return (
    <div className="space-y-3">
      {sections.map((sec, i) => (
        <div key={i} className="rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="font-semibold text-base sm:text-lg">{sec.title}</span>
            {expanded === i ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {expanded === i && (
            <div className="px-4 pb-4 space-y-4 border-t border-border/50">
              {sec.keyPoints.length > 0 && (
                <div className="pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Key Points
                  </p>
                  <ul className="space-y-1.5">
                    {sec.keyPoints.map((p, j) => (
                      <li key={j} className="flex items-start gap-2 text-base">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-2" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sec.definitions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Definitions
                  </p>
                  <div className="space-y-2">
                    {sec.definitions.map((d, j) => (
                      <div key={j} className="text-base">
                        <span className="font-semibold text-primary">{d.term}: </span>
                        <span className="text-muted-foreground">{d.definition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sec.examTips.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Exam Tips
                  </p>
                  <ul className="space-y-1.5">
                    {sec.examTips.map((t, j) => (
                      <li key={j} className="flex items-start gap-2 text-base text-primary">
                        <Star className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sec.mnemonics.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Mnemonics
                  </p>
                  <ul className="space-y-1.5">
                    {sec.mnemonics.map((m, j) => (
                      <li key={j} className="text-base font-mono bg-muted px-3 py-2 rounded-lg">
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
