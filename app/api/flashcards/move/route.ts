import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Moves flashcards into a different deck.
 *
 * This route never existed — the "Move Cards to Another Set" dialog called
 * it, got a 404, and the button's error handler quietly reported "Failed to
 * move." Nothing about the dialog itself was broken; there was simply
 * nothing on the other end of the fetch call. Selecting every card in a
 * deck and moving them all is also how two decks get combined, so this one
 * route covers both.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { flashcardIds?: string[]; targetSetId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { flashcardIds, targetSetId } = body
  if (!Array.isArray(flashcardIds) || flashcardIds.length === 0 || !targetSetId) {
    return NextResponse.json({ error: "flashcardIds and targetSetId are required" }, { status: 400 })
  }

  // Confirm the target deck is actually this learner's — otherwise cards
  // could be moved into someone else's deck by id alone.
  const { data: targetDeck, error: targetError } = await supabase
    .from("flashcard_decks")
    .select("id")
    .eq("id", targetSetId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (targetError || !targetDeck) {
    return NextResponse.json({ error: "Target set not found" }, { status: 404 })
  }

  // Only this learner's own decks can be a source, so the update below is
  // scoped to flashcards currently sitting in one of them — a stray id for
  // someone else's card is silently excluded rather than erroring, since
  // the request may still legitimately move the rest.
  const { data: ownDecks } = await supabase.from("flashcard_decks").select("id").eq("user_id", user.id)
  const ownDeckIds = (ownDecks ?? []).map((d) => d.id)

  const { data: moved, error: moveError } = await supabase
    .from("flashcards")
    .update({ deck_id: targetSetId, updated_at: new Date().toISOString() })
    .in("id", flashcardIds)
    .in("deck_id", ownDeckIds)
    .select("id")

  if (moveError) {
    console.error("[flashcards/move] failed:", moveError.message)
    return NextResponse.json({ error: "Could not move cards", detail: moveError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, moved: moved?.length ?? 0 })
}
