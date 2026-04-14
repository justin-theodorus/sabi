require('dotenv').config({ path: '../.env.local' })
require('dotenv').config({ path: '../.env' }) // fallback

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const Minio = require('minio')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

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

// ── Scenarios ─────────────────────────────────────────────────────────────────

// GET /scenarios — built-in (created_by null) + therapist's custom
app.get('/scenarios', async (req, res) => {
  try {
    const user = await verifyToken(req)
    if (user.user_metadata?.role !== 'therapist') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { data, error } = await supabase
      .from('scenarios')
      .select('id, name, description, slug, mode, npc_personality, support_level, hint_level, created_by, is_active, npc_path')
      .or(`created_by.is.null,created_by.eq.${user.id}`)
      .order('created_at', { ascending: true })
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('GET /scenarios error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// POST /scenarios — create a custom scenario
app.post('/scenarios', async (req, res) => {
  try {
    const user = await verifyToken(req)
    if (user.user_metadata?.role !== 'therapist') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { title, description, category, supportLevel, modeAccess, hintLevel, npcPersonality, unpredictableEvents } = req.body
    if (!title) return res.status(400).json({ error: 'title is required' })
    const { data, error } = await supabase
      .from('scenarios')
      .insert({
        name: title,
        description: description || '',
        slug: (category || 'Community').toLowerCase(),
        support_level: supportLevel || 'Moderate',
        mode: Array.isArray(modeAccess) && modeAccess.includes('Survival Mode') ? 'survival' : 'learning',
        hint_level: hintLevel || 'Gentle nudge',
        npc_personality: npcPersonality || 'Friendly',
        npc_path: unpredictableEvents || 'Off',
        created_by: user.id,
        is_active: true,
        icon_categories: [],
        npc_background_url: '',
      })
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('POST /scenarios error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// PUT /scenarios/:id — update own custom scenario
app.put('/scenarios/:id', async (req, res) => {
  try {
    const user = await verifyToken(req)
    if (user.user_metadata?.role !== 'therapist') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { id } = req.params
    const { title, description, category, supportLevel, modeAccess, hintLevel, npcPersonality, unpredictableEvents } = req.body
    const { data, error } = await supabase
      .from('scenarios')
      .update({
        name: title,
        description: description || '',
        slug: (category || 'Community').toLowerCase(),
        support_level: supportLevel || 'Moderate',
        mode: Array.isArray(modeAccess) && modeAccess.includes('Survival Mode') ? 'survival' : 'learning',
        hint_level: hintLevel || 'Gentle nudge',
        npc_personality: npcPersonality || 'Friendly',
        npc_path: unpredictableEvents || 'Off',
      })
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('PUT /scenarios/:id error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// DELETE /scenarios/:id — delete own custom scenario
app.delete('/scenarios/:id', async (req, res) => {
  try {
    const user = await verifyToken(req)
    if (user.user_metadata?.role !== 'therapist') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { id } = req.params
    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE /scenarios/:id error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// GET /learners/summary — all learners with competence averages (therapist only)
app.get('/learners/summary', async (req, res) => {
  try {
    const user = await verifyToken(req)
    if (user.user_metadata?.role !== 'therapist') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Unique learner IDs
    const { data: sessionRows, error: sessErr } = await supabase
      .from('sessions')
      .select('learner_id')
    if (sessErr) throw sessErr

    const learnerIds = [...new Set((sessionRows || []).map((s) => s.learner_id))]
    if (learnerIds.length === 0) return res.json([])

    // All sessions with competence scores
    const { data: allSessions } = await supabase
      .from('sessions')
      .select('id, learner_id, scenario_id, mode, started_at, status, competence_scores')
      .in('learner_id', learnerIds)
      .order('started_at', { ascending: false })

    // Learner profiles
    const { data: profiles } = await supabase
      .from('learner_profiles')
      .select('*')
      .in('user_id', learnerIds)

    const avgScore = (scoredSessions, key) => {
      if (!scoredSessions.length) return 0
      return Math.round(
        scoredSessions.reduce((a, s) => a + (s.competence_scores?.[key] ?? 0), 0) /
          scoredSessions.length
      )
    }

    const learners = await Promise.all(
      learnerIds.map(async (id) => {
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(id)
          const email = authData?.user?.email ?? ''
          const rawName = email.split('@')[0] ?? ''
          const name = rawName.charAt(0).toUpperCase() + rawName.slice(1) || `Learner ${id.slice(-4)}`
          const profile = (profiles || []).find((p) => p.user_id === id) ?? {}
          const learnerSessions = (allSessions || []).filter((s) => s.learner_id === id)
          const scored = learnerSessions.filter((s) => s.status === 'completed' && s.competence_scores)
          const competence_avg = scored.length ? {
            operational: avgScore(scored, 'operational'),
            linguistic:  avgScore(scored, 'linguistic'),
            social:      avgScore(scored, 'social'),
            strategic:   avgScore(scored, 'strategic'),
            confidence:  avgScore(scored, 'confidence'),
            sessionCount: scored.length,
          } : null
          return {
            id, email, name,
            persona: profile.persona ?? null,
            session_count: learnerSessions.length,
            competence_avg,
          }
        } catch {
          return { id, email: '', name: `Learner ${id.slice(-4)}`, competence_avg: null, session_count: 0 }
        }
      })
    )

    res.json(learners)
  } catch (err) {
    console.error('GET /learners/summary error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// GET /learners — list all learners with profiles (therapist only)
app.get('/learners', async (req, res) => {
  try {
    const user = await verifyToken(req)
    if (user.user_metadata?.role !== 'therapist') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Get unique learner IDs from sessions
    const { data: sessionRows, error: sessErr } = await supabase
      .from('sessions')
      .select('learner_id')
    if (sessErr) throw sessErr

    const learnerIds = [...new Set((sessionRows || []).map((s) => s.learner_id))]
    if (learnerIds.length === 0) return res.json([])

    // Get learner profiles
    const { data: profiles } = await supabase
      .from('learner_profiles')
      .select('*')
      .in('user_id', learnerIds)

    // Get auth user info for each learner
    const learners = await Promise.all(
      learnerIds.map(async (id) => {
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(id)
          const authUser = authData?.user
          const profile = (profiles || []).find((p) => p.user_id === id) ?? {}
          const email = authUser?.email ?? ''
          const rawName = email.split('@')[0] ?? ''
          const name = rawName.charAt(0).toUpperCase() + rawName.slice(1) || `Learner ${id.slice(-4)}`
          return { id, email, name, ...profile }
        } catch {
          return { id, email: '', name: `Learner ${id.slice(-4)}` }
        }
      })
    )

    res.json(learners)
  } catch (err) {
    console.error('GET /learners error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

// GET /learners/:id — full profile for one learner (therapist only)
app.get('/learners/:id', async (req, res) => {
  try {
    const user = await verifyToken(req)
    if (user.user_metadata?.role !== 'therapist') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { id } = req.params

    // Auth user info
    const { data: authData } = await supabase.auth.admin.getUserById(id)
    const authUser = authData?.user
    const email    = authUser?.email ?? ''
    const rawName  = email.split('@')[0] ?? ''
    const name     = rawName.charAt(0).toUpperCase() + rawName.slice(1) || `Learner ${id.slice(-4)}`

    // Learner profile (persona etc.)
    const { data: profile } = await supabase
      .from('learner_profiles')
      .select('*')
      .eq('user_id', id)
      .single()

    // All sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, scenario_id, mode, persona_at_time, started_at, ended_at, duration_seconds, hearts_remaining, status, competence_scores, emotion_summary')
      .eq('learner_id', id)
      .order('started_at', { ascending: false })

    // Aggregate competence scores across completed scored sessions
    const scored = (sessions || []).filter(s => s.status === 'completed' && s.competence_scores)
    const avgScore = (key) => {
      if (!scored.length) return null
      return Math.round(scored.reduce((a, s) => a + (s.competence_scores?.[key] ?? 0), 0) / scored.length)
    }

    const competenceAvg = scored.length ? {
      operational: avgScore('operational'),
      linguistic:  avgScore('linguistic'),
      social:      avgScore('social'),
      strategic:   avgScore('strategic'),
      confidence:  avgScore('confidence'),
      sessionCount: scored.length,
    } : null

    res.json({
      id,
      email,
      name,
      persona:            profile?.persona ?? null,
      persona_confidence: profile?.persona_confidence ?? null,
      therapist_id:       profile?.therapist_id ?? null,
      sessions:           sessions || [],
      competence_avg:     competenceAvg,
    })
  } catch (err) {
    console.error('GET /learners/:id error:', err.message)
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

// GET /dashboard — therapist dashboard summary with recent sessions + learner names
app.get('/dashboard', async (req, res) => {
  try {
    const user = await verifyToken(req)
    if (user.user_metadata?.role !== 'therapist') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id, learner_id, scenario_id, mode, started_at, status')
      .order('started_at', { ascending: false })
      .limit(10)
    if (sessErr) throw sessErr

    const learnerIds = [...new Set((sessions || []).map((s) => s.learner_id))]
    const nameMap = {}
    await Promise.all(
      learnerIds.map(async (id) => {
        try {
          const { data: authData } = await supabase.auth.admin.getUserById(id)
          const email = authData?.user?.email ?? ''
          const raw = email.split('@')[0] ?? ''
          nameMap[id] = raw.charAt(0).toUpperCase() + raw.slice(1) || `Learner ${id.slice(-4)}`
        } catch {
          nameMap[id] = `Learner ${id.slice(-4)}`
        }
      })
    )

    const recentSessions = (sessions || []).map((s) => ({
      id: s.id,
      learner_id: s.learner_id,
      learner_name: nameMap[s.learner_id] || 'Unknown',
      scenario_id: s.scenario_id,
      mode: s.mode,
      started_at: s.started_at,
      status: s.status,
    }))

    res.json({ recentSessions })
  } catch (err) {
    console.error('GET /dashboard error:', err.message)
    res.status(err.message.includes('token') ? 401 : 500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 8004
app.listen(PORT, () => {
  console.log(`Session Service running on port ${PORT}`)
})
