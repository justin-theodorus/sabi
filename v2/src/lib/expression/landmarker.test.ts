import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { FaceLandmarker } from '@mediapipe/tasks-vision'

import { loadLandmarker, sampleFrame } from '@/lib/expression/landmarker'

const fake = (blendshapes: { categoryName: string; score: number }[] | null) =>
  ({
    detectForVideo: () => ({
      faceLandmarks: blendshapes ? [[]] : [],
      faceBlendshapes: blendshapes ? [{ categories: blendshapes }] : [],
      facialTransformationMatrixes: [],
    }),
  }) as unknown as FaceLandmarker

const landmarker = () => ({}) as FaceLandmarker

// Order matters: a successful load caches for the life of the module, so the failure cases run
// first. node:test gives each file its own process, so the cache cannot leak between files.

test('a failed load is not cached, so the next attempt really retries', async () => {
  // `pending ??= create()` alone caches a REJECTED promise forever, because a rejected promise is
  // not null. One transient failure fetching the wasm or the model would then degrade every later
  // attempt for the rest of the page load, in code whose surrounding design (start timeouts,
  // denied/unavailable statuses) treats camera failures as recoverable.
  let attempts = 0
  const failing = () => {
    attempts += 1
    return Promise.reject(new Error('wasm fetch failed'))
  }

  await assert.rejects(loadLandmarker(failing), /wasm fetch failed/)
  await assert.rejects(loadLandmarker(failing), /wasm fetch failed/)
  assert.equal(attempts, 2)
})

test('concurrent callers share one load rather than downloading the model twice', async () => {
  let attempts = 0
  const slow = () => {
    attempts += 1
    return new Promise<FaceLandmarker>((resolve) => setTimeout(() => resolve(landmarker()), 10))
  }

  const [a, b] = await Promise.all([loadLandmarker(slow), loadLandmarker(slow)])
  assert.equal(attempts, 1)
  assert.equal(a, b)
})

test('a successful load is cached', async () => {
  const first = await loadLandmarker()
  const second = await loadLandmarker(() => Promise.reject(new Error('must not be called')))
  assert.equal(first, second)
})

test('a frame with no face yields no sample, rather than a confident neutral', () => {
  // v1's service returned neutral at 100% for a frame with no face in it
  // (expression-service/main.py:91-93), so "looking away" and "calm" were the same record.
  assert.equal(sampleFrame(fake(null), {} as HTMLVideoElement, 0).signals, null)
  assert.equal(sampleFrame(fake([]), {} as HTMLVideoElement, 0).signals, null)
})

test('a frame with a face yields the reduced signal vector', () => {
  const { signals } = sampleFrame(
    fake([
      { categoryName: 'mouthSmileLeft', score: 0.9 },
      { categoryName: 'mouthSmileRight', score: 0.7 },
    ]),
    {} as HTMLVideoElement,
    0,
  )
  assert.equal(signals?.smile, 0.8)
  assert.equal(signals?.jawOpen, 0)
})

test('a frame reports what inference cost whether or not it found a face', () => {
  // Phase 5. The device most worth knowing the cost of is the one whose camera never finds a
  // face, so a duration that only arrived on success would measure the easy half of the work.
  const withFace = sampleFrame(
    fake([{ categoryName: 'mouthSmileLeft', score: 0.9 }]),
    {} as HTMLVideoElement,
    0,
  )
  const withoutFace = sampleFrame(fake(null), {} as HTMLVideoElement, 0)

  for (const frame of [withFace, withoutFace]) {
    assert.equal(typeof frame.inferenceMs, 'number')
    assert.ok(Number.isFinite(frame.inferenceMs), 'inferenceMs must be a real duration')
    assert.ok(frame.inferenceMs >= 0)
  }
})
