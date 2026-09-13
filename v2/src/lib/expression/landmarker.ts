// The MediaPipe Face Landmarker, lazily loaded, once per tab.
//
// This is what replaces expression-service/ — 94 lines of Python, DeepFace, tf-keras,
// opencv-headless, a 2GB memory limit, a 15-second model warmup, an HPA, and a POST of a JPEG
// frame every second from a child's webcam to a server. None of that exists in v2. The frame is
// read straight off the video element into wasm and the only thing that leaves the device is ten
// numbers per second.
//
// Spike numbers behind the choice (Chromium, 640x480, face at 8.5% of frame), taken during Phase 3
// on an M-series Mac by a method that was never written down:
//   MediaPipe blendshapes   p50  8.4ms/frame (CPU delegate), ~7.0MB of assets, face detection included
//   ONNX ViT via transformers.js  p50 676ms/frame (q8/wasm), 50-87MB of model, needs its own detector
//
// The MediaPipe figure did NOT reproduce. Phase 5 measured the deployed build in situ at ~29ms
// p50 per frame (MEASUREMENTS.md section 4), so treat 8.4ms as unreproduced rather than as a
// baseline. The ONNX figure has not been re-measured at all and is spike-only.
//
// The decision survives either way: the gap between the two candidates is two orders of magnitude,
// and 29ms against 676ms is the same conclusion as 8.4ms against 676ms.
// CPU beat GPU (8.4 vs 10.4ms) because the model is small enough that texture upload dominates,
// so there is no WebGL context here and nothing to go wrong on a tablet driver.
//
// Assets are served from /mediapipe on our own origin rather than from a CDN. A session therefore
// makes zero third-party requests, which is what makes "frames never leave the device" a checkable
// claim rather than a promise. (v1's dead WebcamOverlay.tsx:44-51 loaded MediaPipe from jsdelivr.)

import type { FaceLandmarker } from '@mediapipe/tasks-vision'

import { toSignals } from '@/lib/expression/signals'
import type { Signals } from '@/lib/expression/types'

const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/mediapipe/face_landmarker.task'

async function createLandmarker(): Promise<FaceLandmarker> {
  const vision = await import('@mediapipe/tasks-vision')
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH)

  return vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
    runningMode: 'VIDEO',
    numFaces: 1,
  })
}

let pending: Promise<FaceLandmarker> | null = null

/**
 * Shared across mounts. Creating a second one would download and hold a second copy of the model.
 *
 * A REJECTED promise is cleared rather than cached. `pending ??= ...` alone would keep a settled
 * rejection forever, because a rejected promise is not null — so one transient failure fetching
 * the wasm or the model would degrade every later attempt for the rest of the page load, with no
 * retry, in code whose whole surrounding design treats camera failures as recoverable.
 */
export function loadLandmarker(
  create: () => Promise<FaceLandmarker> = createLandmarker,
): Promise<FaceLandmarker> {
  pending ??= create().catch((error: unknown) => {
    pending = null
    throw error
  })

  return pending
}

/**
 * One frame. Null when no face was found, which is not an error — the learner looked away, and the
 * gap is itself the signal that `summarizeExpression` reads as coverage.
 *
 * v1's equivalent could not express this: expression-service returned neutral at 100% for a frame
 * with no face in it (main.py:91-93), so "looking away" and "calm" were the same record.
 */
export interface FrameSample {
  readonly signals: Signals | null
  /** Phase 5. What `detectForVideo` itself cost, on whatever device this is. */
  readonly inferenceMs: number
}

export function sampleFrame(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): FrameSample {
  // Timed around the wasm call and nothing else. A no-face frame costs the same inference as a
  // face-ful one, so the duration is returned either way — reporting only the successful frames
  // would measure the easy half of the workload.
  const startedAt = performance.now()
  const result = landmarker.detectForVideo(video, timestampMs)
  const inferenceMs = performance.now() - startedAt

  const categories = result.faceBlendshapes[0]?.categories
  return {
    signals: categories && categories.length > 0 ? toSignals(categories) : null,
    inferenceMs,
  }
}
