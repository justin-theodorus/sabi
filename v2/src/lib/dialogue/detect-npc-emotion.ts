// Ported as-is from v1 dialogue-engine/main.py:487-504, bug included. Do not fix here.
//
// Finding 2.9: the branches are evaluated sad -> confused -> mad -> surprised -> happy, and the
// `confused` branch matches on the literal substring "?". The system prompt tells the NPC to
// "Ask only ONE thing at a time" (main.py:463) and every scenario prompt says to keep replies to
// 1-2 sentences, so most turns end in a question mark and short-circuit to "confused" before mad,
// surprised or happy can fire. Confirmed live on the very first real request during Phase 0.
//
// Downstream in v1 that froze the NPC sprite on confused.png (ScenarioStage.tsx:50-51) and made
// the therapist-facing `is_repair` flag near-constant-true (session/page.tsx:535).
//
// The fix is Phase 2: ask the model for the emotion in the dialogue call already being made,
// rather than keyword-matching the reply. Porting the bug forward on purpose keeps Phase 1 a
// like-for-like port and keeps the before/after legible. The tests below pin the current
// behaviour, including the defect.

import type { NpcEmotion } from '@/lib/prompt/types'

const SAD = ['sorry', 'sad', 'disappoint', 'upset', 'unfortunate']
const CONFUSED = ['?', 'what do you mean', "don't understand", 'huh', 'unclear', 'pardon']
const MAD_OUTER = [
  '!', 'angry', 'frustrated', 'rude', 'excuse me', 'seriously', 'come on', 'ridiculous', 'nonsense',
]
const MAD_INNER = ['angry', 'frustrated', 'ridiculous', 'seriously']
const SURPRISED = ['wow', 'really', 'oh', 'unexpected', 'surprised', "can't believe"]
const HAPPY = [
  'thank', 'great', 'welcome', 'happy', 'glad', 'good', 'nice', 'pleasure', 'enjoy', 'wonderful',
]

const hasAny = (text: string, words: readonly string[]): boolean =>
  words.some((word) => text.includes(word))

export function detectNpcEmotion(responseText: string): NpcEmotion {
  const t = responseText.toLowerCase()

  if (hasAny(t, SAD)) return 'sad'
  if (hasAny(t, CONFUSED)) return 'confused'
  // main.py:497-499 — the outer list is wider than the inner guard, so "Don't be rude." with no
  // exclamation mark falls straight through the mad branch and keeps going.
  if (hasAny(t, MAD_OUTER) && (t.includes('!') || hasAny(t, MAD_INNER))) return 'mad'
  if (hasAny(t, SURPRISED)) return 'surprised'
  if (hasAny(t, HAPPY)) return 'happy'
  return 'neutral'
}
