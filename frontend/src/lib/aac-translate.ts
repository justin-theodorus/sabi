const AAC_URL = process.env.NEXT_PUBLIC_AAC_URL || 'http://localhost:8005'

export async function translateIcons(iconLabels: string[]): Promise<string> {
  try {
    const res = await fetch(`${AAC_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icons: iconLabels }),
    })
    if (!res.ok) throw new Error(`AAC translate error: ${res.status}`)
    const data = await res.json()
    return data.text as string
  } catch {
    // Fallback to simple join if service unavailable
    return iconLabels.join(' ')
  }
}
