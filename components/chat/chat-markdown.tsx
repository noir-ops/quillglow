"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/**
 * Renders AI chat message content as actual formatted markdown, instead of
 * dumping raw text into the DOM.
 *
 * Before this existed, every AI surface (Tutor, Sprout, the support chatbot,
 * EchoMind, Stress Relief) rendered `{message.content}` directly with
 * `whitespace-pre-wrap` — so a response containing `**bold**`, `### headers`,
 * or a markdown table showed the literal asterisks/pounds/pipes on screen
 * instead of formatted output. `react-markdown` was an installed dependency
 * and was never actually used anywhere.
 *
 * Elements are styled via explicit `components` overrides rather than the
 * `@tailwindcss/typography` "prose" plugin — that plugin isn't installed in
 * this project, and wiring in a new Tailwind v4 plugin correctly (CSS-first
 * config, no guarantee the v3-style registration even applies) is a real risk
 * of a silent no-op where nothing renders styled and nobody notices until a
 * user reports it, exactly like the bug this component fixes. Explicit
 * per-element classes always apply, and give tighter control over the part
 * that was actually broken — the tables.
 *
 * `remark-gfm` is required specifically for table support — base markdown
 * (CommonMark) has no table syntax; GFM is the extension that adds it.
 * Without it, `| Feature | Diesel |` falls through as a plain paragraph.
 */
export function ChatMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-2 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,

          h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold">{children}</h4>,

          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,

          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-muted-foreground">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          hr: () => <hr className="my-4 border-border" />,

          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),

          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),

          // Inline code vs. fenced blocks need different treatment — react-markdown
          // gives both the same <code> element, distinguished only by whether a
          // <pre> ancestor exists in the emitted tree. `inline` isn't reliably
          // passed in every react-markdown version, so detect it structurally:
          // a fenced block's <code> always has a className like "language-xxx"
          // from remark; a bare inline `code` span never does.
          code: ({ className: codeClassName, children, ...props }: any) => {
            const isFenced = /language-/.test(codeClassName || "")
            if (isFenced) {
              return (
                <code className="font-mono text-xs" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium" {...props}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs">
              {children}
            </pre>
          ),

          // Tables: the actual bug in the screenshot — raw `| a | b |` pipes
          // showing as plain text. Real borders + header emphasis + a scroll
          // wrapper so a wide table doesn't blow out a narrow chat bubble.
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-border bg-muted/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border-r border-border px-2.5 py-1.5 text-left font-semibold last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-r border-t border-border px-2.5 py-1.5 align-top last:border-r-0">
              {children}
            </td>
          ),
          tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
