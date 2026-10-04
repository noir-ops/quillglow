/**
 * Explicit-content filter for student questions.
 *
 * Moved here from the Browse page's API (app/api/search/web) when Browse was
 * merged into Study AI. Study AI's chat route had no filter of its own, so
 * without this the merged search bar would have quietly lost the protection
 * Browse provided.
 *
 * It is deliberately narrower than Browse's old list. That list matched raw
 * substrings, which is wrong for a syllabus tutor:
 *   "sex"      blocked "sexual reproduction" / "sex hormones" (core Biology)
 *   "dating"   blocked "radiocarbon dating"
 *   "escort"   blocked "convoy escort" (WW2 history — a Browse quick action
 *              is literally "World War 2 history")
 *   "adult"    blocked "adult education"
 *   "explicit" blocked "explicit formula" (Maths)
 *   "18+"      blocked arithmetic such as "18+5"
 *   "nude"     blocked "denuded" (Geography, deforestation)
 * A student asking a normal syllabus question and being told their question
 * is "inappropriate" is a real harm too, so only terms that signal explicit
 * intent are matched, and on word boundaries.
 *
 * This is a first-line keyword screen, not a moderation system — the tutor's
 * own instructions still apply to whatever gets past it.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  /\bporn\w*/i, // porn, porno, pornography
  /\bxxx\b/i,
  /\bnsfw\b/i,
  /\bhentai\b/i,
  /\bonlyfans\b/i,
  /\berotic\w*/i,
  /\bfetish\w*/i,
  /\bsexy\b/i,
  /\bnudes?\b/i,
  /\bhot (girls|boys)\b/i,
  /\bhook-?ups?\b/i,
  // "sex" on its own is Biology; "sex" plus a media/contact word is not.
  /\bsex (videos?|chat|tape|pics?|pictures|stories|cams?|sites?)\b/i,
]

export function containsBlockedContent(text: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text))
}

export const BLOCKED_CONTENT_MESSAGE =
  "This question contains inappropriate content. QuillGlow is an educational platform."
