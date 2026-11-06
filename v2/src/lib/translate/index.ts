// Ported from v1 aac-icon-service/index.js:10-68. Pure, no I/O.
// v1 ran this as its own container with a network hop; it was never a service.

interface PhrasePattern {
  readonly icons: readonly string[]
  readonly text: string
}

// Checked in order against the start of the sequence; first match wins.
const PHRASE_PATTERNS: readonly PhrasePattern[] = [
  { icons: ['i', 'want'], text: 'I want' },
  { icons: ['i', 'like'], text: 'I like' },
  { icons: ['i', 'need'], text: 'I need' },
  { icons: ['i', 'dont-understand'], text: "I don't understand" },
  { icons: ['thank', 'you'], text: 'Thank you' },
  { icons: ['thank-you'], text: 'Thank you' },
  { icons: ['excuse', 'me'], text: 'Excuse me' },
  { icons: ['excuse-me'], text: 'Excuse me' },
  { icons: ['how', 'are', 'you'], text: 'How are you?' },
  { icons: ['how-are-you'], text: 'How are you?' },
  { icons: ['nice', 'to', 'meet', 'you'], text: 'Nice to meet you' },
  { icons: ['nice-to-meet-you'], text: 'Nice to meet you' },
  { icons: ['good', 'morning'], text: 'Good morning' },
  { icons: ['good-morning'], text: 'Good morning' },
  { icons: ['see', 'you'], text: 'See you' },
  { icons: ['see-you'], text: 'See you' },
  { icons: ['help', 'me'], text: 'Help me' },
  { icons: ['help-me'], text: 'Help me' },
]

// Prefix words that indicate subject/verb intent — add "I" before them
const VERB_PREFIXES: ReadonlySet<string> = new Set([
  'want', 'like', 'need', 'go', 'eat', 'drink', 'buy', 'wait', 'stop', 'help',
])

const capitalise = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1)

const normalise = (label: string): string =>
  label.replace(/[-_]/g, ' ').trim().toLowerCase()

const startsWithPattern = (icons: readonly string[], pattern: readonly string[]): boolean =>
  icons.length >= pattern.length && pattern.every((p, i) => icons[i] === p)

export function translateIcons(icons: readonly string[]): string {
  if (icons.length === 0) return ''

  const normIcons = icons.map(normalise)

  for (const pattern of PHRASE_PATTERNS) {
    const normPattern = pattern.icons.map(normalise)
    if (!startsWithPattern(normIcons, normPattern)) continue

    const rest = normIcons.slice(normPattern.length)
    const tail = rest.length > 0 ? ' ' + rest.join(' ') : ''
    return capitalise(pattern.text + tail)
  }

  if (VERB_PREFIXES.has(normIcons[0])) {
    return capitalise('I ' + normIcons.join(' '))
  }

  return capitalise(normIcons.join(' '))
}
