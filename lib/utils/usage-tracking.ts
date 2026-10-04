import { createClient } from "@/lib/supabase/server"

/**
 * Increments usage tracking for the current user and month
 * @param field - The field to increment ('tasks_created' or 'ai_generations_used')
 * @param amount - The amount to increment by (default: 1)
 */
export async function incrementUsage(field: "tasks_created" | "ai_generations_used", amount = 1) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("[v0] No user found for usage tracking")
      return false
    }

    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Try to get existing usage record
    const { data: existing } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("month_year", currentMonth)
      .maybeSingle()

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from("usage_tracking")
        .update({
          [field]: existing[field] + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (error) {
        console.error("[v0] Error updating usage:", error)
        return false
      }
    } else {
      // Create new record
      const { error } = await supabase.from("usage_tracking").insert({
        user_id: user.id,
        month_year: currentMonth,
        [field]: amount,
      })

      if (error) {
        console.error("[v0] Error creating usage:", error)
        return false
      }
    }

    console.log(`[v0] Successfully incremented ${field} by ${amount}`)
    return true
  } catch (error) {
    console.error("[v0] Error in incrementUsage:", error)
    return false
  }
}
