/** One dialogue turn, as timed from the client. All durations are milliseconds from request start. */
export interface TurnSample {
  readonly sessionOrdinal: number
  readonly turnOrdinal: number
  /** Position across the whole run, so a cold first invocation can be excluded and reported. */
  readonly globalOrdinal: number

  /** Response headers received. Routing plus function start, before any model output. */
  readonly headersMs: number
  /** The first token the LEARNER sees. This is the number the product is judged on. */
  readonly ttftMs: number
  /** Last meaningful byte: the data-turn part carrying the committed turn. */
  readonly ttctMs: number
  /**
   * Stream close. Reported separately from ttctMs because the measurement INSERT now sits between
   * the two, which makes the observer effect a measured quantity rather than a silent bias.
   */
  readonly streamCloseMs: number

  readonly replyChars: number
  readonly turnIndex: number
  readonly seq: number
  /** Verbatim, because it names the edge and the function region the numbers belong to. */
  readonly vercelId: string | null
}

export interface SessionSample {
  readonly sessionOrdinal: number
  readonly sessionId: string
  readonly createMs: number
  readonly endMs: number
  readonly turns: readonly TurnSample[]
  readonly error: string | null
}

export interface BenchEnvironment {
  readonly target: string
  readonly startedAt: string
  readonly gitSha: string
  readonly gitBranch: string
  readonly client: string
  readonly clientRegion: string
  readonly sessions: number
  readonly turnsPerSession: number
  readonly concurrency: number
  readonly note: string
}

export interface BenchRun {
  readonly environment: BenchEnvironment
  readonly sessions: readonly SessionSample[]
}
