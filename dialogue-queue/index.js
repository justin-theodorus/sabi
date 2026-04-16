'use strict'

const express = require('express')
const { Queue } = require('bullmq')
const Redis = require('ioredis')
const { randomUUID } = require('crypto')

const REDIS_URL           = process.env.REDIS_URL           || 'redis://localhost:6379'
const PORT                = parseInt(process.env.PORT       || '8006')
const DIALOGUE_ENGINE_URL = process.env.DIALOGUE_ENGINE_URL || 'http://dialogue-engine:8001'
const JOB_TIMEOUT_MS      = parseInt(process.env.JOB_TIMEOUT_MS || '150000')

const app = express()
app.use(express.json({ limit: '1mb' }))

// ── Redis connections ──────────────────────────────────────────────────────
// BullMQ requires maxRetriesPerRequest: null on its connections
function makeConn(name) {
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false })
  conn.on('error', err => console.error(`[redis:${name}]`, err.message))
  return conn
}

const queueConn = makeConn('queue')

// ── BullMQ queue ───────────────────────────────────────────────────────────
const dialogueQueue = new Queue('dialogue', {
  connection: queueConn,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 1, // no retries — client already waiting on SSE
  },
})

// ── POST /dialogue/stream — enqueue job, proxy response via SSE ────────────
app.post('/dialogue/stream', async (req, res) => {
  const jobId  = randomUUID()
  const channel = `dialogue:${jobId}`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Subscribe before enqueuing so no pub/sub events are missed
  const sub = makeConn(`sub:${jobId.slice(0, 8)}`)
  let closed = false

  const cleanup = () => {
    if (closed) return
    closed = true
    sub.unsubscribe(channel).catch(() => {})
    sub.quit().catch(() => {})
    if (!res.writableEnded) res.end()
  }

  req.on('close', cleanup)

  sub.on('message', (ch, raw) => {
    if (ch !== channel || closed) return
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.type === 'data') {
      if (!res.writableEnded) res.write(msg.text)
    } else if (msg.type === 'end') {
      cleanup()
    } else if (msg.type === 'error') {
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: msg.error })}\n\n`)
      }
      cleanup()
    }
  })

  await sub.subscribe(channel)

  const depth = await dialogueQueue.count()
  await dialogueQueue.add('stream', { jobId, payload: req.body }, {
    jobId,
    attempts: 4,
    backoff: { type: 'exponential', delay: 8_000 }, // 8s, 16s, 32s between retries
  })
  console.log(`[queue] Enqueued job ${jobId.slice(0, 8)} (depth before: ${depth})`)
})

// ── POST /dialogue — direct proxy, no queue needed ─────────────────────────
// Non-streaming calls are short enough that queuing adds overhead without benefit
app.post('/dialogue', async (req, res) => {
  try {
    const upstream = await fetch(`${DIALOGUE_ENGINE_URL}/dialogue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (err) {
    console.error('[proxy:/dialogue]', err.message)
    res.status(502).json({ error: 'Dialogue engine unavailable' })
  }
})

app.get('/health', (_, res) => res.json({ ok: true, service: 'dialogue-queue-api' }))

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[dialogue-queue-api] Listening on :${PORT}`)
  console.log(`[dialogue-queue-api] Upstream: ${DIALOGUE_ENGINE_URL}`)
})
