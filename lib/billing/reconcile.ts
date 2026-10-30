import { getPolarCheckout, getPolarSubscription, polarFetch } from "@/lib/polar"
import { applyPolarSubscription, geniusProductIds } from "@/lib/billing/polar-sync"

/** Resumable scans, including Scholar rows and subscriptions missed entirely by webhooks. */
export async function reconcilePolar(admin: any, { dryRun = false, budgetMs = 210000 } = {}) {
  if (!geniusProductIds().length) throw new Error("Genius product allowlist is not configured")
  const started = Date.now()
  const counts: Record<string, number> = { checked: 0, errors: 0 }
  const jobs: Record<string, boolean> = {}
  for (const job of ["polar-local", "polar-discovery"]) {
    let cursor: string | null = null, page = 1, complete = false, token: string | null = null
    if (!dryRun) {
      const claim = await admin.rpc("claim_billing_job", { p_job: job })
      if (claim.error) throw new Error(claim.error.message)
      if (!claim.data?.claimed) { jobs[job] = false; continue }
      token = claim.data.token; cursor = claim.data.cursor; page = claim.data.page || 1
    }
    let lastError: string | null = null
    try {
      while (Date.now() - started < budgetMs) {
        if (job === "polar-local") {
          let query = admin.from("subscriptions").select("user_id, polar_subscription_id, polar_checkout_id")
            .or("polar_subscription_id.not.is.null,polar_checkout_id.not.is.null").order("user_id").limit(50)
          if (cursor) query = query.gt("user_id", cursor)
          const { data: rows, error } = await query
          if (error) throw new Error(error.message)
          if (!rows?.length) { complete = true; cursor = null; break }
          // A bounded concurrent batch reduces provider latency without firing
          // hundreds of simultaneous requests or starving the later records.
          for (let offset = 0; offset < rows.length; offset += 8) {
            if (Date.now() - started >= budgetMs) break
            const batch = rows.slice(offset, offset + 8)
            await Promise.all(batch.map(async (row: any) => {
              try {
                let subId = row.polar_subscription_id
                if (!subId && row.polar_checkout_id) subId = (await getPolarCheckout(row.polar_checkout_id)).subscription_id
                if (!subId) { counts.no_subscription_found = (counts.no_subscription_found || 0) + 1; counts.errors++; return }
                const sub = await getPolarSubscription(subId)
                const result = await applyPolarSubscription(admin, sub, { dryRun, expectedUserId: row.user_id })
                counts[result.outcome] = (counts[result.outcome] || 0) + 1
                if (result.outcome === "unmatched") counts.errors++
              } catch (error) { counts.errors++; console.error("[polar-reconcile]", row.user_id, error) }
              finally { counts.checked++ }
            }))
            cursor = batch[batch.length - 1].user_id
          }
        } else {
          const response = await polarFetch("/subscriptions/?page=" + page + "&limit=100")
          if (!response.ok) throw new Error("Polar discovery failed: " + response.status)
          const body = await response.json()
          if (!Array.isArray(body.items)) throw new Error("Invalid Polar subscription list")
          for (const sub of body.items) {
            try {
              const result = await applyPolarSubscription(admin, sub, { dryRun })
              counts[result.outcome] = (counts[result.outcome] || 0) + 1
              if (result.outcome === "unmatched") counts.errors++
            } catch (error) { counts.errors++; console.error("[polar-discovery]", sub.id, error) }
            finally { counts.checked++ }
          }
          if (!body.items.length || (body.pagination?.max_page && page >= body.pagination.max_page) || body.items.length < 100) { complete = true; page = 1; break }
          page++
        }
      }
    } catch (error) { lastError = error instanceof Error ? error.message : "Reconciliation failed"; counts.errors++ }
    finally {
      jobs[job] = complete
      if (token) {
        const finish = await admin.rpc("finish_billing_job", { p_job: job, p_token: token, p_cursor: cursor,
          p_complete: complete && !lastError && !counts.errors, p_summary: { ...counts, nextPage: page, error: lastError } })
        if (finish.error) throw new Error(finish.error.message)
      }
    }
  }
  return { dryRun, complete: Object.values(jobs).every(Boolean), jobs, counts }
}
