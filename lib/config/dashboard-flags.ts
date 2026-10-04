/**
 * Dashboard display switches.
 *
 * Seasonal decorations and announcement banners are kept in the code but
 * switched off here, so they can be brought back later by changing one value
 * to `true` and redeploying — no need to rewrite or re-find anything.
 */
export const DASHBOARD_FLAGS = {
  /** Christmas string lights across the top of the "Welcome back" card. */
  seasonalLights: false,
  /** "Stay Active & Chill in the QuillGlow Discord!" banner. */
  discordBanner: false,
  /** "Want early access to our mobile app? Tap here!" banner. */
  mobileEarlyAccessBanner: false,
} as const
