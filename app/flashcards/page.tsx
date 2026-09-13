import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppLayout } from "@/components/dashboard/app-layout"
import { DeckSelector } from "@/components/flashcards/deck-selector"
import { FlashcardContent } from "@/components/flashcards/flashcard-content"
import { FlashcardEmptyState } from "@/components/flashcards/flashcard-empty-state"

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string; mode?: string; tag?: string; search?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch all decks (sets)
  const { data: decks } = await supabase
    .from("flashcard_decks")
    .select("*, flashcards(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const selectedDeckId = params.deck
  const mode = params.mode || "flashcard"
  const tagFilter = params.tag
  const searchQuery = params.search

  let selectedDeck = null
  let flashcards: any[] = []
  let allTags: string[] = []

  if (selectedDeckId) {
    const { data: deck } = await supabase
      .from("flashcard_decks")
      .select("*, flashcards(*)")
      .eq("id", selectedDeckId)
      .eq("user_id", user.id)
      .single()

    selectedDeck = deck
    // Pass ALL flashcards unfiltered — filtering happens client-side in FlashcardStudy
    flashcards = deck?.flashcards || []

    // Still extract tags for reference (passed as allTags)
    allTags = Array.from(
      new Set(flashcards.flatMap((f: any) => f.tags || []))
    ).sort()
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Flashcards</h1>
          <p className="text-muted-foreground mt-2">
            Organize and master your subjects with spaced repetition
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Set Selector Sidebar */}
          <div className="lg:col-span-1">
            <DeckSelector decks={decks || []} selectedDeckId={selectedDeckId} />
          </div>

          {/* Study Area */}
          <div className="lg:col-span-3">
            {!selectedDeckId ? (
              <FlashcardEmptyState hasDecks={(decks?.length || 0) > 0} />
            ) : (
              <FlashcardContent
                deck={selectedDeck}
                flashcards={flashcards}
                allTags={allTags}
                mode={mode}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
