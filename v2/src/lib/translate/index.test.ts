import { test } from 'node:test'
import assert from 'node:assert/strict'

import { translateIcons } from '@/lib/translate/index'

const CASES: ReadonlyArray<readonly [string, readonly string[], string]> = [
  ['returns empty string for no icons', [], ''],

  // Phrase patterns, matched against the start of the sequence
  ['matches a two-icon phrase pattern exactly', ['i', 'want'], 'I want'],
  ['appends the remainder after a matched pattern', ['i', 'want', 'chicken rice'], 'I want chicken rice'],
  ['matches i-need', ['i', 'need', 'water'], 'I need water'],
  ['matches the hyphenated single-token form', ['thank-you'], 'Thank you'],
  ['matches the multi-token form of the same phrase', ['thank', 'you'], 'Thank you'],
  ['keeps punctuation from the pattern text', ['how-are-you'], 'How are you?'],
  ['matches a four-icon pattern', ['nice', 'to', 'meet', 'you'], 'Nice to meet you'],
  ['normalises hyphens inside a pattern icon', ['i', 'dont-understand'], "I don't understand"],
  ['appends the remainder after a greeting pattern', ['good', 'morning', 'uncle'], 'Good morning uncle'],

  // Verb-prefix rule, only reached when no pattern matched
  ['prepends I to a bare verb', ['want', 'water'], 'I want water'],
  ['prepends I to a single bare verb', ['eat'], 'I eat'],
  ['prefers the phrase pattern over the verb prefix', ['help', 'me'], 'Help me'],
  ['falls back to the verb prefix when the pattern does not match', ['help'], 'I help'],

  // Plain join
  ['joins and capitalises when nothing matches', ['chicken rice', 'one'], 'Chicken rice one'],
  ['lowercases input before matching', ['I', 'WANT'], 'I want'],

  // Behaviour worth pinning because it is surprising, not because it is right
  ['only matches patterns at the start of the sequence', ['please', 'i', 'want'], 'Please i want'],
  ['does not re-capitalise a standalone I inside the sentence', ['you', 'and', 'i'], 'You and i'],
]

for (const [name, icons, expected] of CASES) {
  test(name, () => {
    assert.equal(translateIcons(icons), expected)
  })
}
