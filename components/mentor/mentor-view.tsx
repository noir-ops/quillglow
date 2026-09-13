"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Send, Target, ClipboardList, MessageSquare, StickyNote, Users } from "lucide-react"

interface Link {
  id: string
  link_type: "family" | "mentor"
  created_at: string
  trusted_adults: { full_name: string; contact_email: string } | null
}

interface MentorNote {
  id: string
  guardian_link_id: string
  note_type: "goal" | "action_plan" | "progress_review" | "note"
  title: string | null
  content: string
  status: string
  created_at: string
}

interface Message {
  id: string
  sender_user_id: string
  body: string
  created_at: string
}

const TYPE_META: Record<string, { label: string; icon: typeof Target }> = {
  goal: { label: "Goal", icon: Target },
  action_plan: { label: "Action plan", icon: ClipboardList },
  progress_review: { label: "Progress review", icon: ClipboardList },
  note: { label: "Note", icon: StickyNote },
}

function NoteCard({ note }: { note: MentorNote }) {
  const meta = TYPE_META[note.note_type]
  const Icon = meta.icon
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {meta.label}
        </span>
        <div className="flex items-center gap-2">
          {(note.note_type === "goal" || note.note_type === "action_plan") && (
            <Badge variant={note.status === "completed" ? "default" : "outline"} className="text-[10px]">
              {note.status === "completed" ? "Completed in your planner" : "In your planner"}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      {note.title && <p className="font-medium">{note.title}</p>}
      <p className="text-muted-foreground">{note.content}</p>
    </div>
  )
}

function MessageThread({ linkId }: { linkId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch(`/api/mentor-thread/${linkId}`)
    const data = await res.json()
    setMessages(data.messages ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    import("@/lib/supabase/client").then(({ createClient }) =>
      createClient()
        .auth.getUser()
        .then(({ data }) => setUserId(data.user?.id ?? null)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId])

  const send = async () => {
    if (!body.trim()) return
    setSending(true)
    await fetch(`/api/mentor-thread/${linkId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
    setBody("")
    setSending(false)
    load()
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const fromMe = m.sender_user_id === userId
            return (
              <div key={m.id} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    fromMe ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <p>{m.body}</p>
                  <p className={`mt-1 text-[10px] ${fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
      <div className="flex gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Write a message…" />
        <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

function LinkCard({ link, notes }: { link: Link; notes: MentorNote[] }) {
  const linkNotes = notes.filter((n) => n.guardian_link_id === link.id)
  const goalsAndPlans = linkNotes.filter((n) => n.note_type === "goal" || n.note_type === "action_plan")
  const otherNotes = linkNotes.filter((n) => n.note_type === "progress_review" || n.note_type === "note")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{link.trusted_adults?.full_name ?? "Trusted adult"}</span>
          <Badge variant="outline" className="text-[10px]">
            {link.link_type === "family" ? "Family" : "Mentor"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="messages">
          <TabsList>
            <TabsTrigger value="messages" className="text-xs">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Messages
            </TabsTrigger>
            <TabsTrigger value="goals" className="text-xs">
              <Target className="mr-1.5 h-3.5 w-3.5" /> Goals &amp; plans ({goalsAndPlans.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">
              <StickyNote className="mr-1.5 h-3.5 w-3.5" /> Notes ({otherNotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-4">
            <MessageThread linkId={link.id} />
          </TabsContent>

          <TabsContent value="goals" className="mt-4 space-y-2">
            {goalsAndPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No goals or action plans set yet.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  These also appear in your Study Planner, tagged with who set them.
                </p>
                {goalsAndPlans.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-2">
            {otherNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes or progress reviews yet.</p>
            ) : (
              otherNotes.map((n) => <NoteCard key={n.id} note={n} />)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

/**
 * One page for everything a family member or mentor has added: messages
 * (guardian_messages, 045), goals/action plans/progress reviews/notes
 * (mentor_notes, 045). Goals and action plans also live in the Study
 * Planner as real tasks (048) — this page is where the student sees them
 * WITH the context of who set them and why, not just as a bare to-do.
 */
export function MentorView({ links, notes }: { links: Link[]; notes: MentorNote[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-3xl font-bold">Mentor</h1>
        <p className="mt-2 text-muted-foreground">
          Everything your family and mentors have added for you — messages, goals, action plans, and notes.
        </p>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8" />
            <p>No family or mentor linked to your account yet.</p>
            <p>
              Head to{" "}
              <a href="/family-mentors" className="text-primary underline-offset-4 hover:underline">
                Family &amp; Mentors
              </a>{" "}
              to link one.
            </p>
          </CardContent>
        </Card>
      ) : (
        links.map((link) => <LinkCard key={link.id} link={link} notes={notes} />)
      )}
    </div>
  )
}
