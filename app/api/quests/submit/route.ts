import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { emitLearningEvent, refreshScores } from "@/lib/services/learning-graph"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { questId, answers } = await req.json()

    if (!questId || !answers) {
      return NextResponse.json({ error: "Quest ID and answers are required" }, { status: 400 })
    }

    // Get quest details
    const { data: quest, error: questError } = await supabase.from("quests").select("*").eq("id", questId).single()

    if (questError || !quest) {
      return NextResponse.json({ error: "Quest not found" }, { status: 404 })
    }

    // Calculate score
    const questions = quest.questions as Array<{
      correctAnswer: number
    }>

    let correctCount = 0
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctCount++
      }
    })

    const score = Math.round((correctCount / questions.length) * 100)
    const xpEarned = Math.round((score / 100) * quest.xp_reward)

    // Learning Graph: quest completion is graded evidence.
    emitLearningEvent({
      userId: user.id,
      eventType: "quest_completed",
      source: "quests",
      rawTopic: quest.title || null,
      subject: quest.subject || null,
      score,
      maxScore: 100,
      payload: { questId: quest.id, difficulty: quest.difficulty, xpEarned },
    })
    refreshScores(user.id, undefined, quest.subject || undefined)

    // Update user quest progress
    const { error: updateError } = await supabase
      .from("user_quests")
      .update({
        status: "completed",
        score,
        answers,
        completed_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("quest_id", questId)

    if (updateError) {
      console.error("[v0] Error updating quest progress:", updateError)
      return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
    }

    // Update user profile XP and level
    const { data: profile } = await supabase.from("profiles").select("xp, level").eq("id", user.id).single()

    if (profile) {
      const newXp = profile.xp + xpEarned
      const newLevel = Math.floor(newXp / 100) + 1

      await supabase
        .from("profiles")
        .update({
          xp: newXp,
          level: newLevel,
          last_activity_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", user.id)
    }

    return NextResponse.json({
      score,
      correctCount,
      totalQuestions: questions.length,
      xpEarned,
    })
  } catch (error) {
    console.error("[v0] Error submitting quest:", error)
    return NextResponse.json({ error: "Failed to submit quest" }, { status: 500 })
  }
}
