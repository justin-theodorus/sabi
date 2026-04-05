const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// Common multi-icon phrase patterns → natural language
// Checked in order; first match wins
const PHRASE_PATTERNS = [
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
const VERB_PREFIXES = new Set(['want', 'like', 'need', 'go', 'eat', 'drink', 'buy', 'wait', 'stop', 'help'])

// Words that should be capitalised as the start of a sentence
function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Replace underscores/hyphens with spaces and trim
function normalise(label) {
  return label.replace(/[-_]/g, ' ').trim().toLowerCase()
}

function translateIcons(icons) {
  if (!icons || icons.length === 0) return ''

  const normIcons = icons.map(normalise)

  // Try to match multi-word phrase patterns at the start
  for (const pattern of PHRASE_PATTERNS) {
    const normPattern = pattern.icons.map(normalise)
    if (
      normIcons.length >= normPattern.length &&
      normPattern.every((p, i) => normIcons[i] === p)
    ) {
      const rest = normIcons.slice(normPattern.length)
      const tail = rest.length > 0 ? ' ' + rest.join(' ') : ''
      return capitalise(pattern.text + tail)
    }
  }

  // If starts with a bare verb, prepend "I"
  if (VERB_PREFIXES.has(normIcons[0])) {
    return capitalise('I ' + normIcons.join(' '))
  }

  return capitalise(normIcons.join(' '))
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/translate', (req, res) => {
  const { icons } = req.body
  if (!Array.isArray(icons) || icons.length === 0) {
    return res.status(400).json({ error: 'icons must be a non-empty array' })
  }
  const text = translateIcons(icons)
  res.json({ text })
})

const PORT = process.env.PORT || 8005
app.listen(PORT, () => {
  console.log(`AAC Icon Service running on port ${PORT}`)
})
