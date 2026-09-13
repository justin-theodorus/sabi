'use client'

import type { CameraStatus } from '@/lib/expression/use-expression-sampler'

interface Props {
  readonly status: CameraStatus
}

/**
 * Says what the camera is doing and where the frames go.
 *
 * The product points a webcam at children with disabilities. In v1 every frame was JPEG-encoded
 * and POSTed to a server, and nothing in the interface said so — the only camera UI that ever
 * existed was WebcamOverlay.tsx, which was deleted by a redesign and then advertised in the README
 * for ten days afterwards (finding 2.3). The claim is different now and it is worth stating in the
 * one place the learner and the therapist can both see it.
 */
const LABEL: Record<CameraStatus, string | null> = {
  off: null,
  starting: 'Starting camera',
  on: 'Camera on · nothing leaves this device',
  denied: 'Camera off · the session works without it',
  unavailable: 'No camera · the session works without it',
}

export default function CameraBadge({ status }: Props) {
  const label = LABEL[status]
  if (!label) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: status === 'on' ? 'var(--accent, #16a34a)' : 'var(--border)',
        }}
      />
      {label}
    </span>
  )
}
