const DIALOGUE_URL = process.env.NEXT_PUBLIC_DIALOGUE_URL || 'http://localhost:8001'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface DialogueResponse {
  response: string
  audio_base64: string | null
  npc_emotion?: string  // NPC's emotion (happy, sad, mad, confused, etc.)
}

export interface EmotionContext {
  summary_emotion: string
  explanation: string
  avg_score: number
}

export interface DialogueOptions {
  scenario_id?: string
  mode?: string
  persona?: string
  mood_modifier?: string
  emotion?: EmotionContext
}

export async function sendDialogue(
  message: string,
  history: Message[] = [],
  options: DialogueOptions = {}
): Promise<DialogueResponse> {
  const res = await fetch(`${DIALOGUE_URL}/dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      scenario_id: options.scenario_id ?? 'hawker_centre',
      mode: options.mode ?? 'learning',
      persona: options.persona ?? 'zippy_sotong',
      mood_modifier: options.mood_modifier ?? null,
      emotion: options.emotion,
    }),
  })

  if (!res.ok) throw new Error(`Dialogue engine error: ${res.status}`)
  return res.json()
}

export async function fetchHint(
  scenario_id: string,
  npc_last_message: string
): Promise<string> {
  try {
    const res = await fetch(`${DIALOGUE_URL}/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id, npc_last_message }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.hint as string
  } catch {
    return ''
  }
}

export async function judgeResponse(
  scenario_id: string,
  npc_message: string,
  learner_response: string
): Promise<boolean> {
  try {
    const res = await fetch(`${DIALOGUE_URL}/judge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id, npc_message, learner_response }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.off_context as boolean
  } catch {
    return false
  }
}
