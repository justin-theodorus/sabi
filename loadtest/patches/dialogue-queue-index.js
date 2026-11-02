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

  // Subscribe before enqueuing so no pub/sub events are missed
  const sub = makeConn(`sub:${jobId.slice(0, 8)}`)
  let closed = false
  let flushed = false
  let dataBytes = 0
  const pending = []

  const send = (text) => {
    if (closed || res.writableEnded) return
    if (flushed) res.write(text)
    else pending.push(text)
  }

  const cleanup = () => {
    if (closed) return
    closed = true
    sub.unsubscribe(channel).catch(() => {})
    sub.quit().catch(() => {})
    if (!res.writableEnded) res.end()
  }

  sub.on('message', (ch, raw) => {
    if (ch !== channel || closed) return
    let msg
    try { msg = JSON.parse(raw) } catch { return }

    if (msg.type === 'data') {
      dataBytes += Buffer.byteLength(msg.text || '')
      send(msg.text)
    } else if (msg.type === 'end') {
      // A stream that ends having relayed nothing is a failure, not an empty answer.
      if (dataBytes === 0) {
        send(`event: error\ndata: ${JSON.stringify({ error: 'empty stream: worker relayed no data' })}\n\n`)
      }
      cleanup()
    } else if (msg.type === 'error') {
      send(`event: error\ndata: ${JSON.stringify({ error: msg.error })}\n\n`)
      cleanup()
    }
  })

  // Enqueue before committing a status code, so a broker failure is a real 502
  // rather than a 200 carrying an empty body.
  try {
    await sub.subscribe(channel)
    const depth = await dialogueQueue.count()
    await dialogueQueue.add('stream', { jobId, payload: req.body }, {
      jobId,
      attempts: 4,
      backoff: { type: 'exponential', delay: 8_000 }, // 8s, 16s, 32s between retries
    })
    console.log(`[queue] Enqueued job ${jobId.slice(0, 8)} (depth before: ${depth})`)
  } catch (err) {
    console.error('[queue:/dialogue/stream]', err.message)
    closed = true
    sub.quit().catch(() => {})
    return res.status(502).json({ error: 'Could not enqueue dialogue job' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  flushed = true
  while (pending.length && !res.writableEnded) res.write(pending.shift())

  // res, not req. On Node 16+ IncomingMessage emits 'close' as soon as its body
  // stream is consumed, and express.json() consumes it before this handler runs,
  // so req.on('close') fired instantly and tore down the subscription every time.
  res.on('close', cleanup)
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
