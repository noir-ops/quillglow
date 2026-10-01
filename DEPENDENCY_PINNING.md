# Phase 0 · Step 2 — Dependency Pinning

**Status:** ✅ Done. All 63 dependencies pinned to exact versions.

---

## What changed

`package.json` now declares exact versions instead of `latest` / `^` / `~` ranges.
**59 packages changed declaration; zero changed actual version.**

Every pin was taken from `package-lock.json`, i.e. the versions you are already
running. `npm ci` produces a byte-identical tree to before. This is a pure
reproducibility fix, not an upgrade.

A backup of the original is at `package.json.bak` — delete it once you've
confirmed a clean build.

---

## Why this mattered more than it looked

Pinning to whatever `latest` resolves to *today* would have silently jumped you
across major versions. Actual gap between your locked versions and current latest:

| Package | You run | `latest` today | Jump |
|---|---|---|---|
| `ai` | 5.0.107 | 7.0.58 | **2 majors** |
| `@ai-sdk/google` | 2.0.44 | 4.0.39 | **2 majors** |
| `stripe` | 20.0.0 | 22.4.0 | **2 majors** |
| `@stripe/stripe-js` | 8.5.3 | 9.13.0 | 1 major |
| `framer-motion` | 12.23.25 | 13.0.0 | 1 major |
| `@vercel/analytics` | 1.6.1 | 2.0.1 | 1 major |
| `@supabase/ssr` | 0.8.0 | 0.12.4 | 0.x — breaking by convention |
| `next` | 16.0.7 | 16.3.0 | 3 minors |

Any `npm install` on a fresh machine — a new laptop, a CI runner, a collaborator,
a Vercel cache miss — would have pulled that whole column. `framer-motion` v13
alone drives most of the landing-page animation. This is the "mystery breakage
in month 4" scenario, and it's now closed.

---

## Rules from here

1. **Commit `package-lock.json`.** It is the source of truth.
2. **Use `npm ci` in CI and on deploy**, never `npm install`. `ci` respects the
   lockfile exactly; `install` may rewrite it.
3. **Upgrade deliberately**: `npm outdated`, then one package at a time, test,
   commit. Never a bulk bump mid-refactor.
4. **No `latest` in `package.json`, ever again.** If you want a floating range,
   use a caret with an upper bound you've actually tested.

---

## Dead dependencies (review, don't delete blindly)

The Groq → OpenAI/Gemini migration orphaned several packages. Verified by
grepping imports **and** checking whether anything else depends on them.

### Safe to remove — nothing imports them, nothing depends on them

| Package | Note |
|---|---|
| `@google/generative-ai` | Was used by `stress-relief-chat`, now on `lib/ai/provider.ts` |
| `ai` | Was used by `quests/generate` (`generateObject`), now removed |
| `@ai-sdk/google` | Only referenced by `lib/ai/gemini.ts`, which nothing imports |
| `@deepgram/sdk` | No imports anywhere |
| `stripe` | No imports — billing runs through Polar |
| `@stripe/stripe-js` | No imports |
| `react-audio-player` | No imports |

That's ~7 packages. Removing them shrinks install time and the audit surface.

**Before removing:** confirm `stripe` / `@stripe/stripe-js` really are dead. The
admin panel has `STRIPE_SECRET_KEY` in its env, so Stripe may be live *there*.
This list covers the QuillGlow app only.

Also delete `lib/ai/gemini.ts` if you drop `@ai-sdk/google` — it's the only
importer, and it's already superseded by `lib/ai/provider.ts`.

### Do NOT remove — they look unused but are required peers

| Package | Required by |
|---|---|
| `use-sync-external-store` | peer of `zustand`; dep of `recharts` |
| `immer` | peer of `zustand`; dep of `recharts` |
| `@emotion/is-prop-valid` | peer of `framer-motion` |

These are declared at top level deliberately. Removing them causes peer-dependency
warnings and, with `immer`, can break `zustand` middleware at runtime.

### Suggested removal command

```bash
npm uninstall @google/generative-ai ai @ai-sdk/google @deepgram/sdk react-audio-player
git rm lib/ai/gemini.ts
npm run build   # confirm clean
```

Hold `stripe` and `@stripe/stripe-js` until you've checked the admin panel.

---

## Verify

```bash
rm -rf node_modules
npm ci          # must succeed with no version resolution
npm run build   # must succeed
```

If `npm ci` errors about lockfile mismatch, the lockfile predates a package.json
edit — run `npm install` once to resync, review the diff, then commit both.
