import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CameraSupersededError,
  openCamera,
  stopTracks,
  type StreamLike,
  type VideoLike,
} from '@/lib/expression/camera'

const TIMEOUT = 40

interface FakeStream extends StreamLike {
  readonly id: string
  stopped: boolean
}

const fakeStream = (id: string): FakeStream => {
  const stream: FakeStream = {
    id,
    stopped: false,
    getTracks: () => [{ stop: () => { stream.stopped = true } }],
  }
  return stream
}

const fakeVideo = (play: () => Promise<void> = () => Promise.resolve()): VideoLike => ({
  srcObject: null,
  play,
})

const never = () => new Promise<void>(() => {})
const after = <T,>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

test('attaches the stream and returns it when nothing cancels', async () => {
  const video = fakeVideo()
  const stream = fakeStream('a')
  const result = await openCamera(video, () => false, {
    getUserMedia: async () => stream,
    loadLandmarker: async () => null,
  }, TIMEOUT)

  assert.equal(result, stream)
  assert.equal(video.srcObject, stream)
  assert.equal(stream.stopped, false)
})

test('a cancelled start never touches the video element, and closes what it opened', async () => {
  // The race this guards: React StrictMode double-invokes the effect, so two starts run against
  // the same <video>, and their resolution order is not guaranteed to match their call order.
  // Without the check the superseded call overwrites the live stream with one it is about to
  // stop, leaving the badge reading "Camera on" over a frozen frame.
  const video = fakeVideo()
  const live = fakeStream('live')
  video.srcObject = live

  const superseded = fakeStream('superseded')
  await assert.rejects(
    openCamera(video, () => true, {
      getUserMedia: async () => superseded,
      loadLandmarker: async () => null,
    }, TIMEOUT),
    CameraSupersededError,
  )

  assert.equal(video.srcObject, live, 'the live stream must survive')
  assert.equal(superseded.stopped, true, 'the superseded stream must be closed')
  assert.equal(live.stopped, false)
})

test('a camera that opens but never produces a frame times out instead of hanging', async () => {
  // play() on a live MediaStream resolves when frames start flowing and otherwise never settles.
  // Observed against a virtual camera device: the track went live at 640x480 and readyState
  // stayed at HAVE_NOTHING, leaving the badge on "Starting camera" with no way out.
  const stream = fakeStream('silent')
  await assert.rejects(
    openCamera(fakeVideo(never), () => false, {
      getUserMedia: async () => stream,
      loadLandmarker: async () => null,
    }, TIMEOUT),
    /produced no frames/,
  )
  assert.equal(stream.stopped, true, 'the camera must not be left open after giving up')
})

test('a landmarker that never loads times out and closes the camera too', async () => {
  const stream = fakeStream('slow-model')
  await assert.rejects(
    openCamera(fakeVideo(), () => false, {
      getUserMedia: async () => stream,
      loadLandmarker: never,
    }, TIMEOUT),
    /landmarker failed to load/,
  )
  assert.equal(stream.stopped, true)
})

test('a denied camera propagates without leaving anything attached', async () => {
  const video = fakeVideo()
  const denied = new DOMException('denied', 'NotAllowedError')
  await assert.rejects(
    openCamera(video, () => false, {
      getUserMedia: async () => { throw denied },
      loadLandmarker: async () => null,
    }, TIMEOUT),
    (error: unknown) => error === denied,
  )
  assert.equal(video.srcObject, null)
})

test('refuses to start with no video element mounted', async () => {
  await assert.rejects(
    openCamera(null, () => false, {
      getUserMedia: async () => fakeStream('x'),
      loadLandmarker: async () => null,
    }, TIMEOUT),
    /no video element/,
  )
})

test('the slower of two overlapping starts cannot clobber the faster one', async () => {
  // Both calls are in flight against the same element. The first is cancelled but resolves last,
  // which is the ordering that used to break: it would win the srcObject assignment and then stop
  // its own tracks, killing the stream the element was pointing at.
  const video = fakeVideo()
  const first = fakeStream('first')
  const second = fakeStream('second')

  const firstCall = openCamera(video, () => true, {
    getUserMedia: () => after(30, first),
    loadLandmarker: async () => null,
  }, TIMEOUT).catch((error: unknown) => error)

  const secondCall = openCamera(video, () => false, {
    getUserMedia: () => after(5, second),
    loadLandmarker: async () => null,
  }, TIMEOUT)

  assert.equal(await secondCall, second)
  assert.ok((await firstCall) instanceof CameraSupersededError)
  assert.equal(video.srcObject, second)
  assert.equal(second.stopped, false)
  assert.equal(first.stopped, true)
})

test('stopTracks tolerates a null stream', () => {
  assert.doesNotThrow(() => stopTracks(null))
})
