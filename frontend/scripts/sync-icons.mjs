/**
 * Reads all 3 cboard JSON files and downloads every tile with an image.
 * node scripts/sync-icons.mjs
 */
import { createWriteStream, mkdirSync, readFileSync } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.resolve(__dirname, '../public/icons')

const SOURCES = [
  { file: path.join(PUBLIC, 'core_words/core-words.json'), category: 'core_words' },
  { file: path.join(PUBLIC, 'social/social.json'),         category: 'social' },
  { file: path.join(PUBLIC, 'emotions/emotion.json'),      category: 'emotions' },
]

function toId(label) {
  return label.toLowerCase().trim()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function dl(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await pipeline(res.body, createWriteStream(dest))
}

let ok = 0, fail = 0

for (const src of SOURCES) {
  const raw = JSON.parse(readFileSync(src.file, 'utf8'))
  const boards = Array.isArray(raw) ? raw : [raw]
  const allTiles = boards.flatMap(b => b.tiles ?? [])
  const seen = new Set()
  const tiles = allTiles.filter(t => {
    const key = t.label.toLowerCase().trim()
    if (!t.image || seen.has(key)) return false
    seen.add(key); return true
  })

  mkdirSync(path.join(PUBLIC, src.category), { recursive: true })

  for (const tile of tiles) {
    const id  = toId(tile.label)
    const ext = tile.image.endsWith('.webp') ? 'webp' : 'png'
    const dest = path.join(PUBLIC, src.category, `${id}.${ext}`)
    process.stdout.write(`${src.category}/${id}.${ext} … `)
    try {
      await dl(tile.image, dest)
      console.log('✓'); ok++
    } catch (e) {
      console.log(`✗ ${e.message}`); fail++
    }
  }
}
console.log(`\nDone: ${ok} ✓  ${fail} ✗`)
