import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { addDays, isoDay, isPlanActive } from "@/lib/services/study-coach"

export const dynamic = "force-dynamic"

/**
 * EchoMind acting on the Study Planner — always an explicit learner action,
 * never automatic.
 *
 *   { action: "add", items: [{ title, subject?, reason?, planId? }], feedbackId? }
 *       Adds sessions to the planner, one per day starting tomorrow. Each goes
 *       into the matching study plan (given, or found by subject) and is
 *       mirrored onto the planner calendar; with no matching plan it becomes a
 *       standalone planner task. Titles already scheduled and not yet done are
 *       skipped, so tapping twice doesn't duplicate. With feedbackId, that
 *       weekly-review feedback is marked as applied.
 *
 *   { action: "reschedule" }
 *       Catch-up: moves overdue, unfinished plan sessions forward from today,
 *       at most 2 per day, on the plan and the calendar together.
 *
 *   { action: "dismiss", feedbackId }
 *       Hides a weekly-review suggestion set without adding anything.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => null)
    const action = body?.action
    const today = isoDay(new Date())

    if (action === "dismiss") {
      if (!body.feedbackId) return NextResponse.json({ error: "feedbackId is required" }, { status: 400 })
      const { error } = await supabase
        .from("study_plan_review_feedback")
        .update({ applied: true })
        .eq("id", body.feedbackId)
        .eq("user_id", user.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === "add") {
      const items: any[] = Array.isArray(body.items) ? body.items.slice(0, 10) : []
      const clean = items
        .map((x) => ({
          title: typeof x?.title === "string" ? x.title.trim().slice(0, 200) : "",
          subject: typeof x?.subject === "string" && x.subject.trim() ? x.subject.trim().slice(0, 100) : null,
          reason: typeof x?.reason === "string" && x.reason.trim() ? x.reason.trim().slice(0, 500) : null,
          planId: typeof x?.planId === "string" ? x.planId : null,
        }))
        .filter((x) => x.title)
      if (clean.length === 0) return NextResponse.json({ error: "Nothing to add" }, { status: 400 })

      // The learner's plans, to attach sessions to (only their own).
      const { data: plans } = await supabase
        .from("study_plans")
        .select("id, subject, end_date")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
      const myPlans: any[] = plans ?? []
      const norm = (s: string) => s.toLowerCase().trim()
      const pickPlan = (item: (typeof clean)[number]) => {
        if (item.planId) return myPlans.find((p) => p.id === item.planId) ?? null
        if (!item.subject) return null
        const s = norm(item.subject)
        return (
          myPlans.find((p) => p.subject && p.end_date >= today && (norm(p.subject).includes(s) || s.includes(norm(p.subject)))) ?? null
        )
      }

      // Skip anything already scheduled and not done.
      const { data: pending } = await supabase
        .from("tasks")
        .select("title")
        .eq("user_id", user.id)
        .eq("completed", false)
        .limit(1000)
      const already = new Set((pending ?? []).map((t: any) => norm(String(t.title ?? ""))))

      let added = 0
      let skipped = 0
      let day = 1
      for (const item of clean) {
        if (already.has(norm(item.title))) {
          skipped++
          continue
        }
        const due = addDays(today, day++)
        const plan = pickPlan(item)

        if (plan) {
          const { data: goal, error: goalError } = await supabase
            .from("study_plan_goals")
            .insert({
              plan_id: plan.id,
              title: item.title,
              description: item.reason,
              due_date: due,
              priority: "medium",
              is_review: false,
            })
            .select("id")
            .single()
          if (goalError || !goal) {
            console.error("[coach/plan] goal insert failed:", goalError?.message)
            continue
          }
          const { error: taskError } = await supabase.from("tasks").insert({
            user_id: user.id,
            title: item.title,
            description: item.reason,
            due_date: due,
            priority: "medium",
            subject: plan.subject ?? item.subject,
            plan_goal_id: goal.id,
            plan_id: plan.id,
            completed: false,
          })
          if (taskError) console.error("[coach/plan] task mirror failed:", taskError.message)
        } else {
          const { error: taskError } = await supabase.from("tasks").insert({
            user_id: user.id,
            title: item.title,
            description: item.reason,
            due_date: due,
            priority: "medium",
            subject: item.subject,
            completed: false,
          })
          if (taskError) {
            console.error("[coach/plan] task insert failed:", taskError.message)
            continue
          }
        }
        already.add(norm(item.title))
        added++
      }

      if (body.feedbackId) {
        await supabase
          .from("study_plan_review_feedback")
          .update({ applied: true })
          .eq("id", body.feedbackId)
          .eq("user_id", user.id)
      }

      if (added === 0 && skipped === 0) {
        return NextResponse.json({ error: "Could not add to your planner" }, { status: 500 })
      }
      return NextResponse.json({ ok: true, added, skipped })
    }

    if (action === "reschedule") {
      // Active plans only — the same rule the coach uses to count "overdue",
      // so Catch me up moves exactly what the learner was shown.
      const { data: plans } = await supabase.from("study_plans").select("id, end_date").eq("user_id", user.id)
      const planIds = (plans ?? []).filter((p: any) => isPlanActive(p.end_date, today)).map((p: any) => p.id)
      if (planIds.length === 0) return NextResponse.json({ ok: true, moved: 0 })

      const { data: overdue } = await supabase
        .from("study_plan_goals")
        .select("id, plan_id, due_date")
        .in("plan_id", planIds)
        .eq("completed", false)
        .eq("is_review", false)
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(40)

      const PER_DAY = 2
      let moved = 0
      for (const [i, g] of (overdue ?? []).entries()) {
        const due = addDays(today, Math.floor(i / PER_DAY))
        const { error } = await supabase.from("study_plan_goals").update({ due_date: due, updated_at: new Date().toISOString() }).eq("id", g.id)
        if (error) {
          console.error("[coach/plan] reschedule failed:", error.message)
          continue
        }
        await supabase
          .from("tasks")
          .update({ due_date: due, updated_at: new Date().toISOString() })
          .eq("plan_goal_id", g.id)
          .eq("user_id", user.id)
        moved++
      }
      return NextResponse.json({ ok: true, moved })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("[echomind/coach/plan]", error)
    return NextResponse.json({ error: "Could not update your planner" }, { status: 500 })
  }
}
