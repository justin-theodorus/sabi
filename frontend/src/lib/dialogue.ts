const DIALOGUE_URL = process.env.NEXT_PUBLIC_DIALOGUE_URL || 'http://localhost:8001'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface DialogueResponse {
  response: string
  audio_url: string | null
}

export async function sendDialogue(
  message: string,
  history: Message[] = []
): Promise<DialogueResponse> {
  const res = await fetch(`${DIALOGUE_URL}/dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  })

  if (!res.ok) {
    throw new Error(`Dialogue engine error: ${res.status}`)
  }

  return res.json()
}
