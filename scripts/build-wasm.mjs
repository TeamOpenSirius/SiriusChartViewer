// Build native/ (wds-editor preview core + web shims) into public/wasm/ with Emscripten.
//
// Emscripten discovery order: EMSDK env var → emcc already on PATH → C:/SDK/emsc/emsdk.
// Usage: node scripts/build-wasm.mjs [--debug]

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const debug = process.argv.includes('--debug')
const buildDir = path.join(root, 'build', debug ? 'wasm-debug' : 'wasm')
const isWin = process.platform === 'win32'

function which(cmd) {
  try {
    const out = execFileSync(isWin ? 'where' : 'which', [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return out.split(/\r?\n/).find(Boolean) ?? null
  } catch {
    return null
  }
}

function findEmscriptenDir() {
  const candidates = []
  if (process.env.EMSDK) candidates.push(path.join(process.env.EMSDK, 'upstream', 'emscripten'))
  const onPath = which('emcc')
  if (onPath) candidates.push(path.dirname(onPath))
  candidates.push('C:/SDK/emsc/emsdk/upstream/emscripten')
  return candidates.find((dir) => fs.existsSync(path.join(dir, isWin ? 'emcmake.bat' : 'emcmake'))
    || fs.existsSync(path.join(dir, 'emcmake.exe'))) ?? null
}

if (!fs.existsSync(path.join(root, 'third_party/wds-editor/core/CMakeLists.txt'))) {
  throw new Error('third_party/wds-editor is missing. Run: git submodule update --init')
}

const emDir = findEmscriptenDir()
if (!emDir) {
  throw new Error('Emscripten not found. Set EMSDK or put emcc on PATH.')
}

const env = { ...process.env, PATH: `${emDir}${path.delimiter}${process.env.PATH}` }
// emsdk ships emcmake.exe on Windows, so no shell is needed.
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, env, stdio: 'inherit' })

const configureArgs = ['cmake', '-S', 'native', '-B', buildDir, `-DCMAKE_BUILD_TYPE=${debug ? 'Debug' : 'Release'}`]
if (which('ninja')) configureArgs.push('-G', 'Ninja')

if (!fs.existsSync(path.join(buildDir, 'CMakeCache.txt'))) {
  run('emcmake', configureArgs)
}
run('cmake', ['--build', buildDir])

// The Emscripten file packager embeds the absolute output path as the package
// key in the loader; replace it so builds do not leak local paths.
const loader = path.join(root, 'public/wasm/sirius-viewer.js')
const js = fs.readFileSync(loader, 'utf8')
const fixed = js.replace(/PACKAGE_NAME="[^"]*sirius-viewer\.data"/g, 'PACKAGE_NAME="sirius-viewer.data"')
if (fixed !== js) fs.writeFileSync(loader, fixed)
console.log(`[build-wasm] done → public/wasm (${debug ? 'Debug' : 'Release'})`)
