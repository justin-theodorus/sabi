const SESSION_URL =
  process.env.NEXT_PUBLIC_SESSION_URL || 'http://localhost:8004'

/**
 * Upload a WebM session recording blob to MinIO via the session service.
 * Returns the stored object key, or empty string on failure.
 * Errors are swallowed — a failed upload must not block the session-over screen.
 */
export async function uploadSessionVideo(
  token: string,
  sessionId: string,
  blob: Blob
): Promise<string> {
  try {
    const form = new FormData()
    form.append('file', blob, `${sessionId}.webm`)
    const res = await fetch(`${SESSION_URL}/sessions/${sessionId}/video`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) {
      console.warn('[minio-upload] Upload failed:', res.status)
      return ''
    }
    const { video_url } = await res.json()
    return video_url ?? ''
  } catch (err) {
    console.warn('[minio-upload] Upload error:', err)
    return ''
  }
}
