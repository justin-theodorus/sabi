const SESSION_URL = process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

async function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

export async function startSession(
  token: string,
  scenario_id: string,
  mode: string,
  persona: string
): Promise<string> {
  const res = await fetch(`${SESSION_URL}/sessions`, {
    method: 'POST',
    headers: await authHeaders(token),
    body: JSON.stringify({ scenario_id, mode, persona }),
  })
  if (!res.ok) throw new Error(`Session start error: ${res.status}`)
  const data = await res.json()
  return data.session_id as string
}

export async function endSession(
  token: string,
  sessionId: string,
  heartsRemaining?: number
): Promise<void> {
  await fetch(`${SESSION_URL}/sessions/${sessionId}/end`, {
    method: 'PUT',
    headers: await authHeaders(token),
    body: JSON.stringify({ hearts_remaining: heartsRemaining }),
  })
}

export async function logEvent(
  token: string,
  sessionId: string,
  event_type: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(`${SESSION_URL}/sessions/${sessionId}/events`, {
      method: 'POST',
      headers: await authHeaders(token),
      body: JSON.stringify({ event_type, payload }),
    })
  } catch {
    // Non-critical — don't crash the session on logging failure
  }
}
