require('dotenv').config({ path: '../.env' })

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const Minio = require('minio')
const Redis = require('ioredis')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

// ── Redis client ──────────────────────────────────────────────────────────────

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false, // don't queue commands if Redis is down
  maxRetriesPerRequest: 1,
})

redis.on('connect', () => console.log('[redis] Connected'))
redis.on('error', (err) => console.warn('[redis] Error (non-fatal):', err.message))

// Wrap Redis calls so a Redis outage never crashes the session service
async function rTry(fn) {
  try { return await fn() } catch (e) {
    console.warn('[redis] Skipped (Redis unavailable):', e.message)
    return null
  }
}

const SESSION_STATE_TTL = 60 * 60 * 24 // 24 hours

// ── MinIO client ──────────────────────────────────────────────────────────────

const MINIO_BUCKET = process.env.MINIO_BUCKET || 'session-videos'

// MINIO_PUBLIC_URL is the URL the browser uses to reach MinIO.
// Inside Docker, MinIO is at http://minio:9000 internally, but the browser
// must reach it via http://localhost:9000. Presigned URLs are rewritten
// to use the public URL before being returned to the client.
const MINIO_PUBLIC_URL = (process.env.MINIO_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '')

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

/** Rewrite the internal MinIO host in a presigned URL to the public-facing URL. */
function toPublicUrl(presigned) {
  // Replace scheme+host+port (e.g. http://minio:9000) with MINIO_PUBLIC_URL
  return presigned.replace(/^https?:\/\/[^/?#]+/, MINIO_PUBLIC_URL)
}

// Ensure bucket exists on startup
minioClient.bucketExists(MINIO_BUCKET, (err, exists) => {
  if (err) {
    console.error('[minio] bucketExists error:', err.message)
    return
  }
  if (!exists) {
    minioClient.makeBucket(MINIO_BUCKET, 'us-east-1', (mkErr) => {
      if (mkErr) console.error('[minio] makeBucket error:', mkErr.message)
      else console.log(`[minio] Created bucket: ${MINIO_BUCKET}`)
    })
  } else {
    console.log(`[minio] Bucket ready: ${MINIO_BUCKET}`)
  }
})

// ── Redis emotion flush ───────────────────────────────────────────────────────

/**
 * Reads all buffered emotion events for a session from Redis and batch-inserts
 * them into Supabase. Called when a session ends. Safe to call if Redis is down
 * or the list is empty — it will simply no-op.
 */
async function flushEmotions(sessionId) {
  const key = `session:${sessionId}:emotions`
  const raw = await rTry(() => redis.lrange(key, 0, -1))
  if (!raw || raw.length === 0) return

  const rows = raw.map((entry) => {
    const e = JSON.parse(entry)
    return {
      session_id: sessionId,
      session_offset_ms: e.session_offset_ms,
      dominant_emotion: e.dominant_emotion,
      scores: e.scores,
    }
  })

  const { error } = await supabase.from('emotion_events').insert(rows)
  if (error) {
    console.error(`[redis] flushEmotions failed for ${sessionId}:`, error.message)
  } else {
    console.log(`[redis] Flushed ${rows.length} emotion events for session ${sessionId}`)
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────

// Verify Supabase JWT and return user; throws on invalid token
async function verifyToken(req) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new Error('Missing authorization header')
  }
  const token = auth.slice(7)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Invalid token')
  return data.user
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// ── Sessions ──────────────────────────────────────────────────────────────────

// POST /sessions — start a new session
app.post('/sessions', async (req, res) => {
  try {
    const user = await verifyToken(req)
    const { scenario_id, mode, persona } = req.body

    if (!scenario_id || !mode) {
      return res.status(400).json({ error: 'scenario_id and mode are required' })
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        learner_id: user.id,
        scenario_id,
        mode,
        persona_at_time: persona || 'guided_learner',
        hearts_remaining: mode === 'survival' ? 5 : null,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) throw error

    // Seed live session state in Redis
    const sessionKey = `session:${data.id}:state`
    await rTry(() => redis.hset(sessionKey,
      'hearts',      mode === 'survival' ? 5 : -1,
      'turn_index',  0,
      'mode',        mode,
      'persona',     persona || 'guided_learner',
    ))
    await rTry(() => redis.expire(sessionKey, SESSION_STATE_TTL))

    res.json({ session_id: data.id })
  } catch (err) {
    console.error('POST /sessions error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// GET /sessions — list sessions (therapist sees all, learner sees own)
app.get('/sessions', async (req, res) => {
  try {
    const user = await verifyToken(req)
    const role = user.user_metadata?.role
    const { learner_id } = req.query

    let query = supabase
      .from('sessions')
      .select('id, learner_id, scenario_id, mode, persona_at_time, started_at, ended_at, duration_seconds, hearts_remaining, status, video_url, competence_scores, emotion_summary')
      .order('started_at', { ascending: false })
      .limit(50)

    if (role === 'therapist') {
      if (learner_id) query = query.eq('learner_id', learner_id)
    } else {
      query = query.eq('learner_id', user.id)
    }

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('GET /sessions error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// PUT /sessions/:id/end — end a session
app.put('/sessions/:id/end', async (req, res) => {
  try {
    const user = await verifyToken(req)
    const { id } = req.params
    const { hearts_remaining } = req.body

    const now = new Date().toISOString()

    // Fetch session start time to compute duration
    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('started_at, learner_id')
      .eq('id', id)
      .single()

    if (fetchErr || !session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    if (session.learner_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const durationSeconds = Math.round(
      (new Date(now) - new Date(session.started_at)) / 1000
    )

    const updatePayload = {
      ended_at: now,
      status: 'completed',
      duration_seconds: durationSeconds,
    }
    if (hearts_remaining !== undefined) {
      updatePayload.hearts_remaining = hearts_remaining
    }

    const { error } = await supabase
      .from('sessions')
      .update(updatePayload)
      .eq('id', id)

    if (error) throw error

    // Flush buffered emotion events from Redis → Supabase, then clean up keys
    await flushEmotions(id)
    await rTry(() => redis.del(`session:${id}:state`, `session:${id}:emotions`))

    res.json({ ok: true })
  } catch (err) {
    console.error('PUT /sessions/:id/end error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// PUT /sessions/:id/state — update live session state in Redis (hearts, turn_index)
app.put('/sessions/:id/state', async (req, res) => {
  try {
    await verifyToken(req)
    const { id } = req.params
    const { hearts, turn_index } = req.body

    const updates = []
    if (hearts !== undefined)     updates.push('hearts',     hearts)
    if (turn_index !== undefined) updates.push('turn_index', turn_index)

    if (updates.length > 0) {
      await rTry(() => redis.hset(`session:${id}:state`, ...updates))
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('PUT /sessions/:id/state error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// GET /sessions/:id/state — read live session state from Redis
app.get('/sessions/:id/state', async (req, res) => {
  try {
    await verifyToken(req)
    const { id } = req.params
    const state = await rTry(() => redis.hgetall(`session:${id}:state`))
    if (!state || Object.keys(state).length === 0) {
      return res.status(404).json({ error: 'No live state found (session may have ended)' })
    }
    res.json({
      hearts:      state.hearts     !== undefined ? parseInt(state.hearts)     : null,
      turn_index:  state.turn_index !== undefined ? parseInt(state.turn_index) : null,
      mode:        state.mode    ?? null,
      persona:     state.persona ?? null,
    })
  } catch (err) {
    console.error('GET /sessions/:id/state error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// POST /sessions/:id/events — log a session event
app.post('/sessions/:id/events', async (req, res) => {
  try {
    await verifyToken(req)
    const { id } = req.params
    const { event_type, payload } = req.body

    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' })
    }

    const { error } = await supabase
      .from('session_events')
      .insert({ session_id: id, event_type, payload: payload || {} })

    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /sessions/:id/events error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// POST /sessions/:id/emotions — log a single DeepFace emotion sample
app.post('/sessions/:id/emotions', async (req, res) => {
  try {
    await verifyToken(req)
    const { id } = req.params
    const { session_offset_ms, dominant_emotion, scores } = req.body

    if (session_offset_ms === undefined || !dominant_emotion || !scores) {
      return res.status(400).json({
        error: 'session_offset_ms, dominant_emotion, and scores are required',
      })
    }

    // Buffer in Redis for sub-10ms writes; flushed to Supabase on session end
    const emotionKey = `session:${id}:emotions`
    const entry = JSON.stringify({ session_offset_ms, dominant_emotion, scores })
    const written = await rTry(async () => {
      await redis.rpush(emotionKey, entry)
      await redis.expire(emotionKey, SESSION_STATE_TTL)
      return true
    })

    // Fallback: write directly to Supabase if Redis is unavailable
    if (!written) {
      const { error } = await supabase
        .from('emotion_events')
        .insert({ session_id: id, session_offset_ms, dominant_emotion, scores })
      if (error) console.error('[supabase] emotion insert fallback error:', error.message)
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('POST /sessions/:id/emotions error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// POST /sessions/:id/video — upload WebM session recording to MinIO
app.post('/sessions/:id/video', upload.single('file'), async (req, res) => {
  try {
    const user = await verifyToken(req)
    const { id } = req.params

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('learner_id')
      .eq('id', id)
      .single()

    if (fetchErr || !session) return res.status(404).json({ error: 'Session not found' })
    if (session.learner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

    const objectKey = `sessions/${id}.webm`
    const fileBuffer = req.file.buffer

    await new Promise((resolve, reject) => {
      minioClient.putObject(
        MINIO_BUCKET,
        objectKey,
        fileBuffer,
        fileBuffer.length,
        { 'Content-Type': 'video/webm' },
        (err) => (err ? reject(err) : resolve())
      )
    })

    const { error: updateErr } = await supabase
      .from('sessions')
      .update({ video_url: objectKey })
      .eq('id', id)

    if (updateErr) throw updateErr

    res.json({ ok: true, video_url: objectKey })
  } catch (err) {
    console.error('POST /sessions/:id/video error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// GET /sessions/:id/video-url — generate a 1-hour presigned URL for the session video
app.get('/sessions/:id/video-url', async (req, res) => {
  try {
    await verifyToken(req)
    const { id } = req.params

    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('video_url')
      .eq('id', id)
      .single()

    if (fetchErr || !session) return res.status(404).json({ error: 'Session not found' })
    if (!session.video_url) return res.status(404).json({ error: 'No video recorded for this session' })

    const presignedUrl = await minioClient.presignedGetObject(
      MINIO_BUCKET,
      session.video_url,
      60 * 60  // 1 hour expiry
    )

    res.json({ presigned_url: toPublicUrl(presignedUrl) })
  } catch (err) {
    console.error('GET /sessions/:id/video-url error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// GET /sessions/:id/video-stream — proxy video from MinIO through session-service.
// No auth required: the session UUID is a sufficient capability token for local demo.
// Handles Range requests so the browser can seek without downloading the full file.
app.get('/sessions/:id/video-stream', async (req, res) => {
  try {
    const { id } = req.params
    const { data: session, error: fetchErr } = await supabase
      .from('sessions')
      .select('video_url')
      .eq('id', id)
      .single()

    if (fetchErr || !session) return res.status(404).json({ error: 'Session not found' })
    if (!session.video_url) return res.status(404).json({ error: 'No video recorded' })

    const objectKey = session.video_url
    const stat = await minioClient.statObject(MINIO_BUCKET, objectKey)
    const totalSize = stat.size

    console.log(`[video-stream] ${id} → ${objectKey} (${(totalSize / 1024 / 1024).toFixed(1)} MB)`)

    res.setHeader('Content-Type', 'video/webm')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=3600')

    const rangeHeader = req.headers.range
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      const startByte = parseInt(match[1], 10)
      const endByte = match[2] ? parseInt(match[2], 10) : totalSize - 1
      const chunkSize = endByte - startByte + 1

      console.log(`[video-stream] Range ${startByte}-${endByte}/${totalSize}`)

      res.status(206)
      res.setHeader('Content-Range', `bytes ${startByte}-${endByte}/${totalSize}`)
      res.setHeader('Content-Length', chunkSize)

      const stream = await minioClient.getPartialObject(MINIO_BUCKET, objectKey, startByte, chunkSize)
      stream.pipe(res)
    } else {
      res.setHeader('Content-Length', totalSize)
      const stream = await minioClient.getObject(MINIO_BUCKET, objectKey)
      stream.pipe(res)
    }
  } catch (err) {
    console.error('GET /sessions/:id/video-stream error:', err.message)
    if (!res.headersSent) {
      res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
    }
  }
})

const PORT = process.env.PORT || 8004
app.listen(PORT, () => {
  console.log(`Session Service running on port ${PORT}`)
})
