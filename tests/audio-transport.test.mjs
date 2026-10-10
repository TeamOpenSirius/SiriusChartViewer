import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code = ts.transpileModule(readFileSync(new URL('../src/lib/audioTransport.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { AudioTransport } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function setup(t) {
  const previous = globalThis.AudioContext
  const resumed = deferred(), decoded = deferred()
  globalThis.AudioContext = class {
    state = 'suspended'
    currentTime = 0
    createGain() { return { gain: { value: 1 }, connect() {} } }
    resume() { return resumed.promise.then(() => { this.state = 'running' }) }
    decodeAudioData() { return decoded.promise }
    close() { return Promise.resolve() }
  }
  const transport = new AudioTransport()
  t.after(() => { transport.dispose(); globalThis.AudioContext = previous })
  return { transport, resumed, decoded }
}
test('pause during AudioContext resume cancels the pending play request', async t => {
  const { transport, resumed } = setup(t)
  const playing = transport.play()
  transport.pause()
  resumed.resolve()
  await playing
  assert.equal(transport.isPlaying, false)
})
test('audio decoding blocks play and disposal rejects late decoded data', async t => {
  const { transport, decoded } = setup(t)
  const loading = transport.setMusic(new ArrayBuffer(1))
  await transport.play()
  assert.equal(transport.isPlaying, false)
  transport.dispose()
  decoded.resolve({ duration: 5 })
  await loading
  assert.equal(transport.hasMusic, false)
  assert.equal(transport.isPlaying, false)
})
