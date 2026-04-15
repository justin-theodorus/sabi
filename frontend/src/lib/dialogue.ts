const DIALOGUE_URL = process.env.NEXT_PUBLIC_DIALOGUE_URL || 'http://localhost:8001'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface DialogueResponse {
  response: string
  audio_base64: string | null
  npc_emotion?: string  // NPC's emotion (happy, sad, mad, confused, etc.)
  session_complete?: boolean
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
  available_icons?: string[]
  turn_index?: number
  npc_initiated?: boolean
  active_event?: string
  // Custom scenario overrides (passed through to dialogue engine)
  npc_personality?: string
  support_level?: string
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
      available_icons: options.available_icons,
      turn_index: options.turn_index ?? 0,
      npc_initiated: options.npc_initiated ?? false,
      active_event: options.active_event,
      npc_personality: options.npc_personality ?? null,
      support_level: options.support_level ?? null,
    }),
  })

  if (!res.ok) throw new Error(`Dialogue engine error: ${res.status}`)
  return res.json()
}

export async function fetchHint(
  scenario_id: string,
  npc_last_message: string,
  available_icons: string[] = []
): Promise<string> {
  try {
    const res = await fetch(`${DIALOGUE_URL}/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id, npc_last_message, available_icons }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.hint as string
  } catch {
    return ''
  }
}

export interface StreamCallbacks {
  onText: (chunk: string) => void
  onAudio: (index: number, base64: string) => void
  onDone: (emotion: string, sessionComplete: boolean, fullText: string) => void
}

export async function streamDialogue(
  message: string,
  history: Message[],
  options: DialogueOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const res = await fetch(`${DIALOGUE_URL}/dialogue/stream`, {
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
      available_icons: options.available_icons,
      turn_index: options.turn_index ?? 0,
      npc_initiated: options.npc_initiated ?? false,
      active_event: options.active_event,
      npc_personality: options.npc_personality ?? null,
      support_level: options.support_level ?? null,
    }),
  })

  if (!res.ok) throw new Error(`Dialogue engine error: ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventType = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (eventType === 'text') callbacks.onText(data.chunk)
          else if (eventType === 'audio') callbacks.onAudio(data.index, data.audio_base64)
          else if (eventType === 'done') callbacks.onDone(data.npc_emotion, data.session_complete, data.full_text)
          else if (eventType === 'error') throw new Error(data.error ?? 'dialogue_error')
        } catch {}
        eventType = ''
      }
    }
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
