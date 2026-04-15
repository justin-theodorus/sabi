'use strict'

const { Worker } = require('bullmq')
const Redis = require('ioredis')

const REDIS_URL           = process.env.REDIS_URL           || 'redis://localhost:6379'
const DIALOGUE_ENGINE_URL = process.env.DIALOGUE_ENGINE_URL || 'http://dialogue-engine:8001'
const JOB_TIMEOUT_MS      = parseInt(process.env.JOB_TIMEOUT_MS || '150000')
// Concurrency is the only throttle needed.
// With KEDA maxReplicas=3 and WORKER_CONCURRENCY=2:
//   max concurrent Claude calls = 6
//   at 10s min/call → 36 req/min max — well under Anthropic's 50 req/min limit.
// No separate rate limiter needed: concurrency × (60 / min_response_time) < 50.
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2')

function makeConn(name) {
  const conn = new Redis(REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false })
  conn.on('error', err => console.error(`[redis:${name}]`, err.message))
  return conn
}

const workerConn = makeConn('worker')

const worker = new Worker('dialogue', async (job) => {
  const { jobId, payload } = job.data
  const channel = `dialogue:${jobId}`
  const pub = makeConn(`pub:${jobId.slice(0, 8)}`)

  try {
    const upstream = await fetch(`${DIALOGUE_ENGINE_URL}/dialogue/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
    })

    // Anthropic returned 429 despite concurrency limits (burst or quota edge case).
    // Throw so BullMQ retries with exponential backoff instead of failing the job.
    if (upstream.status === 429) {
      throw new Error('rate_limit_429')
    }

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      await pub.publish(channel, JSON.stringify({
        type: 'error',
        error: `upstream ${upstream.status}: ${text}`,
      }))
      return
    }

    for await (const chunk of upstream.body) {
      await pub.publish(channel, JSON.stringify({
        type: 'data',
        text: Buffer.from(chunk).toString('utf8'),
      }))
    }

    await pub.publish(channel, JSON.stringify({ type: 'end' }))
    console.log(`[worker] Completed job ${jobId.slice(0, 8)}`)
  } catch (err) {
    if (err.message === 'rate_limit_429') throw err  // let BullMQ retry

    console.error(`[worker] Job ${jobId.slice(0, 8)} error:`, err.message)
    await pub.publish(channel, JSON.stringify({ type: 'error', error: err.message })).catch(() => {})
  } finally {
    pub.quit().catch(() => {})
  }
}, {
  connection: workerConn,
  concurrency: WORKER_CONCURRENCY,
  lockDuration: 180_000,
  stalledInterval: 30_000,
})

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed after all retries:`, err.message)
})

worker.on('stalled', jobId => {
  console.warn(`[worker] Job ${jobId} stalled`)
})

console.log(`[dialogue-queue-worker] Started — concurrency: ${WORKER_CONCURRENCY}, upstream: ${DIALOGUE_ENGINE_URL}`)
