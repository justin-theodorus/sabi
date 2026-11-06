// Opening the camera, as a function rather than as effect body.
//
// It lives out here because the interesting behaviour is a race, and a race that only exists
// inside a useEffect cannot be tested. The structural VideoLike/StreamLike types are satisfied by
// the real HTMLVideoElement and MediaStream, and by a plain object in a node:test.

/** The part of MediaStream this file needs. */
export interface StreamLike {
  getTracks(): readonly { stop(): void }[]
}

/** The part of HTMLVideoElement this file needs. */
export interface VideoLike {
  srcObject: unknown
  play(): Promise<void>
}

export interface CameraDeps<S extends StreamLike> {
  readonly getUserMedia: (constraints: MediaStreamConstraints) => Promise<S>
  /** Loading the inference model is part of starting, so "Camera on" means genuinely ready. */
  readonly loadLandmarker: () => Promise<unknown>
}

/**
 * How long the camera gets to produce its first frame before the session gives up on it.
 *
 * `video.play()` on a live MediaStream resolves when frames start flowing and otherwise never
 * settles at all, so without this a camera that opens but delivers nothing leaves the badge
 * reading "Starting camera" for the whole session with no way out. Observed against a virtual
 * camera device, which is exactly the case a learner on unfamiliar hardware would hit.
 */
export const CAMERA_START_TIMEOUT_MS = 8_000

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: 640, height: 480, facingMode: 'user' },
  audio: false,
}

export const stopTracks = (stream: StreamLike | null): void => {
  for (const track of stream?.getTracks() ?? []) track.stop()
}

export class CameraSupersededError extends Error {
  constructor() {
    super('camera start superseded')
    this.name = 'CameraSupersededError'
  }
}

async function withTimeout<T>(work: Promise<T>, message: string, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Opens the camera and attaches it, or throws having left nothing running.
 *
 * `isCancelled` is checked immediately after getUserMedia resolves and before the element is
 * touched. Two calls can be in flight against the same `<video>` — React StrictMode double-invokes
 * the effect, and getUserMedia is slow enough to overlap — and their resolution order is not
 * guaranteed to match their call order. Without this check the superseded call can overwrite the
 * live stream with the one it is about to stop, which leaves the badge reading "Camera on" over a
 * frozen frame and the sampler reading the same dead image once a second, silently, forever.
 */
export async function openCamera<S extends StreamLike>(
  video: VideoLike | null,
  isCancelled: () => boolean,
  deps: CameraDeps<S>,
  timeoutMs: number = CAMERA_START_TIMEOUT_MS,
): Promise<S> {
  if (!video) throw new Error('no video element mounted')

  const stream = await deps.getUserMedia(CAMERA_CONSTRAINTS)

  if (isCancelled()) {
    stopTracks(stream)
    throw new CameraSupersededError()
  }
  video.srcObject = stream

  try {
    await withTimeout(video.play(), 'camera opened but produced no frames', timeoutMs)
    await withTimeout(deps.loadLandmarker(), 'face landmarker failed to load', timeoutMs)
  } catch (error) {
    // The camera is open at this point. Close it before rethrowing, or the browser's recording
    // indicator stays lit for a feature that has already given up.
    stopTracks(stream)
    throw error
  }

  return stream
}
