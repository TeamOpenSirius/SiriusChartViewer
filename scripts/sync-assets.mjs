// Copy runtime assets the browser loads directly (hit SFX + hold loop sidecar)
// from the wds-editor submodule into public/effects/. Skins are not copied:
// they are preloaded into the wasm virtual filesystem at build time.

import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const src = path.join(root, 'third_party/wds-editor/effects')
const dst = path.join(root, 'public/effects')

if (!fs.existsSync(src)) {
  throw new Error('third_party/wds-editor/effects not found. Run: git submodule update --init')
}

fs.mkdirSync(dst, { recursive: true })
let copied = 0
for (const name of fs.readdirSync(src)) {
  if (!/\.(ogg|json)$/i.test(name)) continue
  fs.copyFileSync(path.join(src, name), path.join(dst, name))
  copied++
}
console.log(`[sync-assets] ${copied} effect files → public/effects`)
