// Assertions for the bench harness.
//
// This file is the load test's memory of tests/locust/locustfile.py:276, which read a
// `translation` key that `aac-icon-service` has never emitted — and neither has v2's
// /api/translate. The expression was
//
//     translate_resp.json().get("translation", " ".join(icons))
//
// so every run since the file was written silently fell back to joining the icon labels. The
// translate leg was timed, its output discarded, and nothing ever said so. A load test that
// tolerates a shape it does not recognise is a load test measuring a fiction.
//
// Hence: nothing here has a default, nothing is optional-chained into a fallback, and every
// failure names the field and what was found instead.

export class BenchAssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BenchAssertionError'
  }
}

const fail = (what: string, detail: string): never => {
  throw new BenchAssertionError(`${what}: ${detail}`)
}

export function assertStatus(response: Response, expected: number, what: string): void {
  if (response.status !== expected) {
    fail(what, `expected HTTP ${expected}, got ${response.status} ${response.statusText}`)
  }
}

export function assertHeaderMatches(response: Response, header: string, pattern: RegExp, what: string): void {
  const value = response.headers.get(header)
  if (value === null) fail(what, `no ${header} header`)
  if (!pattern.test(value!)) fail(what, `${header} was "${value}", expected ${pattern}`)
}

export function assertPresent<T>(value: T, what: string): NonNullable<T> {
  if (value === null || value === undefined) fail(what, `was ${value}`)
  return value as NonNullable<T>
}

export function assertNonEmptyString(value: unknown, what: string): string {
  if (typeof value !== 'string') fail(what, `expected a string, got ${typeof value}`)
  if ((value as string).trim() === '') fail(what, 'was empty')
  return value as string
}

export function assertNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(what, `expected a finite number, got ${JSON.stringify(value)}`)
  }
  return value as number
}

export function assertEqual<T>(actual: T, expected: T, what: string): void {
  if (actual !== expected) fail(what, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
