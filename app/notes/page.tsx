import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { NotesSidebar } from "@/components/notes/notes-sidebar"
import { NoteEditor } from "@/components/notes/note-editor"
import { RevisionNotesGenerator } from "@/components/revision-notes/revision-notes-generator"
import { NotesTabs } from "@/components/notes/notes-tabs"

export const metadata = {
  title: "Revision & Notes | QuillGlow",
  description: "Your notes and AI-generated revision notes in one place",
}

/**
 * Revision & Notes — the notes editor and the AI revision-notes generator
 * combined into one destination, per the navigation consolidation. Both
 * feature sets are preserved in full as tabs.
 *
 * `/revision-notes` redirects here with ?tab=revision so existing links work.
 */
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; tab?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  const selectedNoteId = params.note
  let selectedNote = null

  if (selectedNoteId) {
    const { data: note } = await supabase.from("notes").select("*").eq("id", selectedNoteId).single()
    selectedNote = note
  }

  return (
    <AppLayout>
      <NotesTabs
        defaultTab={params.tab === "revision" ? "revision" : "notes"}
        notesPanel={
          <div className="flex h-[calc(100vh-9rem)] md:h-[calc(100vh-5rem)]">
            <NotesSidebar notes={notes || []} selectedNoteId={selectedNoteId} />
            <div className="flex-1 overflow-hidden">
              {selectedNote ? (
                <NoteEditor note={selectedNote} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>Select a note or create a new one</p>
                </div>
              )}
            </div>
          </div>
        }
        revisionPanel={
          <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <RevisionNotesGenerator />
          </div>
        }
      />
    </AppLayout>
  )
}
