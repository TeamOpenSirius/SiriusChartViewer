// Build the embeddable component into dist-lib/:
//   sirius-chart-viewer.js / .css   ES module + styles (Vue external)
//   types/                          TypeScript declarations
//   assets/wasm, assets/effects     runtime files the host must serve (pass their URL as asset-base)

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'dist-lib')
const bins = { vite: 'vite/bin/vite.js', 'vue-tsc': 'vue-tsc/bin/vue-tsc.js' }
const run = (name, args) =>
  execFileSync(process.execPath, [path.join(root, 'node_modules', bins[name]), ...args], { cwd: root, stdio: 'inherit' })

for (const dir of ['public/wasm', 'public/effects']) {
  if (!fs.existsSync(path.join(root, dir))) throw new Error(`${dir} missing — run build:wasm and sync:assets first`)
}

run('vite', ['build', '--config', 'vite.lib.config.ts'])
run('vue-tsc', ['-p', 'tsconfig.lib.json'])

for (const [from, to] of [['public/wasm', 'assets/wasm'], ['public/effects', 'assets/effects']]) {
  fs.cpSync(path.join(root, from), path.join(out, to), { recursive: true })
}
console.log('[build-lib] done → dist-lib/')
