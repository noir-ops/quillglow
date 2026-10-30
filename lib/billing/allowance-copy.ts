import type { FeatureUsage } from "@/lib/billing/usage"

export function canUpgradeAllowance(usage: FeatureUsage | null): boolean {
  return !!usage && !usage.isGenius && usage.limit >= 0 &&
    (usage.upgradeLimit == null || usage.upgradeLimit === -1 || usage.upgradeLimit > usage.limit)
}
export function allowanceHint(usage: FeatureUsage | null, unit: string): string {
  const reset = usage?.limit === 0 ? "This feature is not included in your current plan." : "Your allowance resets on the 1st of each month (UTC)."
  if (!canUpgradeAllowance(usage)) return reset
  if (usage?.upgradeLimit === -1) return `Genius has no monthly limit for this feature. ${reset}`
  if (usage?.upgradeLimit != null) return `Genius includes ${usage.upgradeLimit.toLocaleString()} ${unit} per month. ${reset}`
  return `See the Genius plan allowances, or wait for your monthly reset.`
}
