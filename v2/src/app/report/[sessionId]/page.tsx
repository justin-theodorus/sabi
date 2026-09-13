// The session report. Public, read-only, no cookie.
//
// WHY THIS IS SAFE TO SERVE WITHOUT AUTH, stated here because v1 made the same argument and lost
// it (session-service/index.js:789).
//
// The session id is the only capability, so four things have to hold at once:
//
//  1. It is unguessable. crypto.randomUUID, CSPRNG-backed, 122 bits, minted server-side
//     (api/sessions/route.ts:46).
//  2. It cannot be discovered. v1's UUID leaked because it was also embedded in client-readable
//     Supabase rows that a listing endpoint returned. v2 has NO list endpoint and no GET API route
//     at all — every route is a POST that resolves the session from the httpOnly cookie — so the
//     only way to hold an id is to have been given it.
//  3. There is nothing identifying behind it. No account, no name, no email, no video. Under
//     Phase 3 no webcam frame ever leaves the device; what is stored is ten numbers a second
//     reduced to one descriptor per turn.
//  4. It confers no write. This page reads. Every mutation still requires the cookie, which is the
//     actual fix for finding S4 and is untouched by this page existing.
//
// Removing the auth wall is the point rather than a compromise: it is what closes S1-S4, and a
// report a reader cannot open without signing in is a report that does not demonstrate the
// product. The page is served noindex so the capability is not handed to a crawler.

import { notFound } from 'next/navigation'

import CompetenceRadar from '@/components/CompetenceRadar'
import EmotionTimeline from '@/components/EmotionTimeline'
import ReportTranscript from '@/components/ReportTranscript'
import { buildReport, endingLabel, type ReportView } from '@/lib/report/view'
import { loadAllEvents, loadSession } from '@/lib/session/repository'

export const runtime = 'nodejs'
// The report changes while scoring runs, so it is never cached.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SABI session report',
  robots: { index: false, follow: false },
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 22,
  boxShadow: 'var(--shadow-sm)',
  padding: 24,
}

const heading: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: 17,
  fontWeight: 800,
  letterSpacing: '-.2px',
}

/**
 * `params` is declared by hand rather than via the generated `PageProps<'/report/[sessionId]'>`.
 * Every route handler in this app already declares it this way, and the generated global only
 * exists after `next typegen` has run, so depending on it makes `npm run typecheck` fail on a
 * clean checkout — which is CI's first step.
 */
export default async function ReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params

  const session = await loadSession(sessionId)
  if (!session) notFound()

  const view = buildReport(session, await loadAllEvents(sessionId))

  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '32px 16px 56px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <Header view={view} />

      <section style={card} aria-labelledby="scores-heading">
        <h2 id="scores-heading" style={heading}>
          Communication competence
        </h2>
        <Scores view={view} />
      </section>

      <section style={card} aria-labelledby="emotion-heading">
        <h2 id="emotion-heading" style={heading}>
          Expression through the session
        </h2>
        <EmotionTimeline timeline={view.timeline} />
      </section>

      <section style={card} aria-labelledby="transcript-heading">
        <h2 id="transcript-heading" style={heading}>
          Transcript
        </h2>
        <ReportTranscript turns={view.transcript} />
      </section>
    </main>
  )
}

function Header({ view }: { view: ReportView }) {
  const minutes = view.durationMs === null ? null : Math.round(view.durationMs / 60_000)

  return (
    <header>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-.4px' }}>
        Session report
      </h1>
      <p style={{ margin: '6px 0 12px', fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
        Hawker centre &middot; {endingLabel(view)} &middot; {view.turnCount}{' '}
        {view.turnCount === 1 ? 'turn' : 'turns'}
        {minutes === null ? '' : ` · ${minutes === 0 ? 'under a minute' : `${minutes} min`}`}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span className={view.mode === 'survival' ? 'badge-survival' : 'badge-learning'}>
          {view.mode} mode
        </span>
        <span className="badge-neutral">{view.heartsRemaining} of 5 hearts left</span>
        <time
          className="badge-neutral"
          dateTime={view.startedAt.toISOString()}
          style={{ display: 'inline-flex' }}
        >
          {view.startedAt.toISOString().slice(0, 10)}
        </time>
      </div>
    </header>
  )
}

/**
 * Every branch renders something true. There is no state in which a radar is drawn from anything
 * other than a validated, model-produced score — which is the whole of the difference from v1,
 * where a response carrying no numbers at all became a 50/50/50/50/50 chart with no marker that it
 * had been invented (main.py:793-797).
 */
function Scores({ view }: { view: ReportView }) {
  const { scoring } = view

  if (scoring.state === 'scored') {
    return (
      <>
        <CompetenceRadar scores={scoring.scores} />
        <p
          style={{
            margin: '18px 0 0',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          {scoring.scores.summary}
        </p>
        {scoring.scores.strategic === null ? (
          <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Strategic competence is marked not observed: nothing in this session went wrong, so the
            learner was never given anything to repair. That is not the same as lacking the skill,
            and it is not scored as though it were.
          </p>
        ) : null}
      </>
    )
  }

  return <Notice {...NOTICES[scoring.state]} detail={detailFor(view)} />
}

const NOTICES = {
  running: {
    title: 'Scoring this session',
    body: 'The assessment is being generated. Reload in a few seconds.',
  },
  skipped: {
    title: 'Too short to score',
    body: 'A rubric-based assessment of two or three exchanges would be invention rather than measurement, so none was produced.',
  },
  failed: {
    title: 'This session could not be scored',
    body: 'The assessment call failed and no score was written. An absent score is recoverable; an invented one is not, so nothing was filled in. The transcript and the expression readings below are unaffected.',
  },
  unscored: {
    title: 'This session is still in progress',
    body: 'Scoring runs once the session ends.',
  },
} as const

function detailFor(view: ReportView): string | null {
  if (view.scoring.state === 'skipped') {
    return `${view.scoring.learnerTurns} ${view.scoring.learnerTurns === 1 ? 'turn' : 'turns'} recorded.`
  }
  if (view.scoring.state === 'failed' && view.scoring.errorKind) {
    return `Reported cause: ${view.scoring.errorKind.replace(/_/g, ' ')}.`
  }
  return null
}

function Notice({
  title,
  body,
  detail,
}: {
  title: string
  body: string
  detail: string | null
}) {
  return (
    <div
      style={{
        padding: '18px 20px',
        borderRadius: 16,
        background: 'var(--surface-sub)',
        border: '1px dashed var(--border)',
      }}
    >
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</p>
      <p
        style={{
          margin: '6px 0 0',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
        }}
      >
        {body}
        {detail ? ` ${detail}` : ''}
      </p>
    </div>
  )
}
