// Copies the Face Landmarker wasm runtime out of node_modules and into public/.
//
// It is not committed: it is a build output of the pinned dependency, so it belongs in .gitignore
// next to .next/. The 3.7MB model file IS committed, because it comes from a Google Cloud Storage
// URL rather than from the package, and a build that silently depends on a remote fetch is the
// thing this whole phase is arguing against.
//
// Only the non-module variants are copied. FilesetResolver.forVisionTasks(path) defaults to
// useModule=false, so vision_wasm_module_internal.* would never be requested. Both the SIMD and
// nosimd builds go across, because the resolver picks between them at runtime and a missing one
// is a 404 in the middle of a session rather than an error at build time.

import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const to = join(root, 'public', 'mediapipe', 'wasm')

const WANTED = /^vision_wasm_(internal|nosimd_internal)\.(js|wasm)$/

async function main() {
  await mkdir(to, { recursive: true })

  const names = (await readdir(from)).filter((name) => WANTED.test(name))
  if (names.length === 0) throw new Error(`no wasm runtime found in ${from}`)

  await Promise.all(names.map((name) => copyFile(join(from, name), join(to, name))))
  console.log(`[mediapipe] copied ${names.length} files to public/mediapipe/wasm`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
