/**
 * Downloads cboard pictogram images into public/icons/{category}/{id}.{ext}
 * Run with: node scripts/download-icons.mjs
 */

import { createWriteStream, mkdirSync } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.resolve(__dirname, '../public/icons')

const CB = 'https://cboardsymbols.blob.core.windows.net/generated-pictograms'

const ICONS = [
  // ── core_words ──────────────────────────────────────────────────────────
  { id: 'i',       category: 'core_words', url: `${CB}/69c65bac0dfb9ec8ae098475_skin_emoji.png` },
  { id: 'you',     category: 'core_words', url: `${CB}/69ca9de6f7e5da1112b9f2eb_skin_emoji.png` },
  { id: 'it',      category: 'core_words', url: `${CB}/69c3b97cf7e5da1112b9dc83.png` },
  { id: 'we',      category: 'core_words', url: `${CB}/699469870dfb9ec8ae091225_skin_emoji.png` },
  { id: 'what',    category: 'core_words', url: `${CB}/6945e805aa9cf31fe205b60a.webp` },
  { id: 'where',   category: 'core_words', url: `${CB}/6945e7f8ed4208aeaece311a.webp` },
  { id: 'yes',     category: 'core_words', url: `${CB}/69b2f6790dfb9ec8ae095871.png` },
  { id: 'not',     category: 'core_words', url: `${CB}/6945e7ceed4208aeaece3110.webp` },
  { id: 'dont',    category: 'core_words', url: `${CB}/6945e7bb03f5ea811ae0d42f.webp` },
  { id: 'go',      category: 'core_words', url: `${CB}/6945e7f9aa9cf31fe205b600-skin_emoji.webp` },
  { id: 'stop',    category: 'core_words', url: `${CB}/698145c40dfb9ec8ae08f1df.png` },
  { id: 'eat',     category: 'core_words', url: `${CB}/69a112618141cc96494ff86c_skin_emoji.png` },
  { id: 'drink',   category: 'core_words', url: `${CB}/69cbbac4f7e5da1112b9f6ee.png` },
  { id: 'do',      category: 'core_words', url: `${CB}/6945e7f9aa9cf31fe205b5fe-skin_emoji.webp` },
  { id: 'in',      category: 'core_words', url: `${CB}/69bcebe68141cc96495032cd.png` },
  { id: 'on',      category: 'core_words', url: `${CB}/696cde888e068901427fe658.png` },
  { id: 'quick',   category: 'core_words', url: `${CB}/6945e7c8ed4208aeaece3105.webp` },
  { id: 'slow',    category: 'core_words', url: `${CB}/6945e7c8aa9cf31fe205b5ec.webp` },
  { id: 'loud',    category: 'core_words', url: `${CB}/6945e7c903f5ea811ae0d436.webp` },
  { id: 'like',    category: 'core_words', url: `${CB}/69c3b90e0dfb9ec8ae097793.png` },

  // ── emotions (from emotion board v2) ────────────────────────────────────
  { id: 'feel',         category: 'emotions', url: `${CB}/69c3b9c40dfb9ec8ae097799_skin_emoji.png` },
  { id: 'happy',        category: 'emotions', url: `${CB}/69a82b4e8141cc96495005d4_skin_emoji.png` },
  { id: 'sad',          category: 'emotions', url: `${CB}/69c3be298141cc9649503f7e_skin_emoji.png` },
  { id: 'angry',        category: 'emotions', url: `${CB}/6945ea20aa9cf31fe205b68b-skin_emoji.webp` },
  { id: 'surprised',    category: 'emotions', url: `${CB}/6945f74003f5ea811ae0d4a7-skin_emoji.webp` },
  { id: 'scared',       category: 'emotions', url: `${CB}/6945ea2003f5ea811ae0d486-skin_emoji.webp` },
  { id: 'excited',      category: 'emotions', url: `${CB}/6945ea1403f5ea811ae0d482-skin_emoji.webp` },
  { id: 'bored',        category: 'emotions', url: `${CB}/697bbb0d0dfb9ec8ae08e920_skin_emoji.png` },
  { id: 'anxious',      category: 'emotions', url: `${CB}/69517a8688e1f6bcd2150f34_skin_emoji.png` },
  { id: 'calm',         category: 'emotions', url: `${CB}/69b97fc6f7e5da1112b9c71d_skin_emoji.png` },
  { id: 'confused',     category: 'emotions', url: `${CB}/6959c8913cedf87e4c0beba6_skin_emoji.png` },
  { id: 'frustrated',   category: 'emotions', url: `${CB}/6945f740ed4208aeaece31db-skin_emoji.webp` },
  { id: 'lonely',       category: 'emotions', url: `${CB}/6959c8723cedf87e4c0beba2_skin_emoji.png` },
  { id: 'proud',        category: 'emotions', url: `${CB}/6945f724aa9cf31fe205b6c9-skin_emoji.webp` },
  { id: 'embarrassed',  category: 'emotions', url: `${CB}/6945f724aa9cf31fe205b6c7-skin_emoji.webp` },
  { id: 'grateful',     category: 'emotions', url: `${CB}/6959cf61386f71aca05f25dc_skin_emoji.png` },
  { id: 'hopeful',      category: 'emotions', url: `${CB}/6945f72403f5ea811ae0d4a3-skin_emoji.webp` },
  { id: 'disappointed', category: 'emotions', url: `${CB}/69675b5a8dd02fdd8ed62b15_skin_emoji.png` },
  { id: 'relaxed',      category: 'emotions', url: `${CB}/6959c8ab386f71aca05f25ab_skin_emoji.png` },
  { id: 'curious',      category: 'emotions', url: `${CB}/6959ca1c386f71aca05f25b1_skin_emoji.png` },
  { id: 'overwhelmed',  category: 'emotions', url: `${CB}/6959ca1c1a686290ffe03cbc_skin_emoji.png` },
  { id: 'content',      category: 'emotions', url: `${CB}/69675b4d0dde53dd42472b68_skin_emoji.png` },
  { id: 'motivated',    category: 'emotions', url: `${CB}/69b97fa0f7e5da1112b9c719_skin_emoji.png` },
  { id: 'inspired',     category: 'emotions', url: `${CB}/69675b4d5b6943baf125419d_skin_emoji.png` },
  { id: 'loved',        category: 'emotions', url: `${CB}/6959cf673cedf87e4c0bebdb_skin_emoji.png` },
  { id: 'joyful',       category: 'emotions', url: `${CB}/69675b4d8dd02fdd8ed62b11_skin_emoji.png` },
  { id: 'playful',      category: 'emotions', url: `${CB}/69b97ffff7e5da1112b9c722_skin_emoji.png` },
  { id: 'determined',   category: 'emotions', url: `${CB}/6945f70fed4208aeaece31d3-skin_emoji.webp` },
  { id: 'cheerful',     category: 'emotions', url: `${CB}/696cde88c090bd8a7ea33f68_skin_emoji.png` },
  { id: 'relieved',     category: 'emotions', url: `${CB}/6989df95f7e5da1112b9615e_skin_emoji.png` },
  { id: 'confident',    category: 'emotions', url: `${CB}/69837c9ef7e5da1112b95700_skin_emoji.png` },
  { id: 'shy',          category: 'emotions', url: `${CB}/69806fc28141cc96494fb2f5_skin_emoji.png` },
  { id: 'brave',        category: 'emotions', url: `${CB}/69a1fcc98141cc96494ffab7_skin_emoji.png` },
  { id: 'silly',        category: 'emotions', url: `${CB}/69806fbcf7e5da1112b94cc8_skin_emoji.png` },
  { id: 'thoughtful',   category: 'emotions', url: `${CB}/697b9171f7e5da1112b944a7_skin_emoji.png` },
  { id: 'optimistic',   category: 'emotions', url: `${CB}/6989dfaf8141cc96494fc79e_skin_emoji.png` },
  { id: 'peaceful',     category: 'emotions', url: `${CB}/6973eaf60dfb9ec8ae08d3d4.png` },
  { id: 'loving',       category: 'emotions', url: `${CB}/69c88dc6f7e5da1112b9ef0a_skin_emoji.png` },
  { id: 'affectionate', category: 'emotions', url: `${CB}/69c88dc08141cc9649505247_skin_emoji.png` },
  { id: 'guilty',       category: 'emotions', url: `${CB}/6959ca1c3cedf87e4c0bebac_skin_emoji.png` },
  { id: 'serious',      category: 'emotions', url: `${CB}/695e7bf31a686290ffe046e7_skin_emoji.png` },
  { id: 'vulnerable',   category: 'emotions', url: `${CB}/69675b438dd02fdd8ed62b0d_skin_emoji.png` },
  { id: 'passionate',   category: 'emotions', url: `${CB}/6989df8f0dfb9ec8ae0901a3_skin_emoji.png` },
  { id: 'nostalgic',    category: 'emotions', url: `${CB}/6959ca271a686290ffe03cc0_skin_emoji.png` },
]

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await pipeline(res.body, createWriteStream(dest))
}

let ok = 0, fail = 0
for (const icon of ICONS) {
  const ext = icon.url.endsWith('.webp') ? 'webp' : 'png'
  const dir = path.join(PUBLIC, icon.category)
  mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `${icon.id}.${ext}`)
  process.stdout.write(`${icon.category}/${icon.id}.${ext} … `)
  try {
    await download(icon.url, dest)
    console.log('✓')
    ok++
  } catch (e) {
    console.log(`✗ ${e.message}`)
    fail++
  }
}
console.log(`\nDone: ${ok} OK, ${fail} failed.`)
