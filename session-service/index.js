require('dotenv').config({ path: '../.env' })

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const Minio = require('minio')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

// ── MinIO client ──────────────────────────────────────────────────────────────

const MINIO_BUCKET = process.env.MINIO_BUCKET || 'session-videos'

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

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
    res.json({ ok: true })
  } catch (err) {
    console.error('PUT /sessions/:id/end error:', err.message)
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

    const { error } = await supabase
      .from('emotion_events')
      .insert({ session_id: id, session_offset_ms, dominant_emotion, scores })

    if (error) throw error
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

    res.json({ presigned_url: presignedUrl })
  } catch (err) {
    console.error('GET /sessions/:id/video-url error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 8004
app.listen(PORT, () => {
  console.log(`Session Service running on port ${PORT}`)
})
