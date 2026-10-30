/**
 * The ONE answer to "is this learner on Genius?".
 *
 * Both helpers call the database rule in scripts/066 (user_plan), so the app,
 * the quota engine and the webhook all agree. Before this there were three
 * different rules (status 'active' only; 'active' or 'trialing'; plan name
 * only), so a learner could be Genius in one feature and Scholar in another.
 */
export type Plan = "scholar" | "genius"

/** The signed-in learner's plan. Pass the request's user-scoped Supabase client. */
export async function getMyPlan(supabase: any): Promise<Plan> {
  const { data, error } = await supabase.rpc("my_plan")
  if (error) {
    console.error("[billing] my_plan failed:", error.message)
    return "scholar"
  }
  return data === "genius" ? "genius" : "scholar"
}

/** Any learner's plan — server only (service-role client). */
export async function getUserPlan(admin: any, userId: string): Promise<Plan> {
  const { data, error } = await admin.rpc("user_plan", { p_user_id: userId })
  if (error) {
    console.error("[billing] user_plan failed:", error.message)
    return "scholar"
  }
  return data === "genius" ? "genius" : "scholar"
}
