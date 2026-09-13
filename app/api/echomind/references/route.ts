import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const uid = user.id

    // Fetch all reference sources in parallel
    const [
      { data: exams },
      { data: mockAttempts },
      { data: decks },
      { data: notes },
      { data: revisionNotes },
      { data: essayAttempts },
      { data: tasks },
      { data: tutorMemory },
      { data: audioOverviews },
    ] = await Promise.all([
      supabase.from("generated_exams").select("id, subject, pdf_filename, created_at, summary").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("mock_exam_attempts").select("id, score_percentage, correct_answers, total_questions, status, completed_at, created_at").eq("user_id", uid).eq("status", "completed").order("completed_at", { ascending: false }).limit(20),
      supabase.from("flashcard_decks").select("id, name, subject, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("notes").select("id, title, subject, tags, created_at, content").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("revision_notes").select("id, title, subject, mode, depth_level, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("essay_attempts").select("id, question_text, ai_score, word_count, created_at, feedback_json").eq("user_id", uid).order("created_at", { ascending: false }).limit(15),
      supabase.from("tasks").select("id, title, subject, priority, completed, completed_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
      supabase.from("tutor_memory").select("id, subject, topic, confidence_level, times_asked, last_seen").eq("user_id", uid).order("last_seen", { ascending: false }).limit(20),
      supabase.from("audio_overviews").select("id, title, subject, study_mode, duration_mode, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(15),
    ])

    return NextResponse.json({
      exams: exams ?? [],
      mockAttempts: mockAttempts ?? [],
      decks: decks ?? [],
      notes: notes ?? [],
      revisionNotes: revisionNotes ?? [],
      essayAttempts: essayAttempts ?? [],
      tasks: tasks ?? [],
      tutorMemory: tutorMemory ?? [],
      audioOverviews: audioOverviews ?? [],
    })
  } catch (error) {
    console.error("[echomind/references]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
