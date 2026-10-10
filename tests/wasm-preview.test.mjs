import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'

// Exercise the built browser WASM and packaged skins directly, also against Net's vendored copy.
const directory = resolve(process.env.SIRIUS_VIEWER_WASM_DIR ?? 'public/wasm')
let module
let generation = 0
let server
after(() => new Promise(done => server ? server.close(done) : done()))
before(async () => {
  const { default: create } = await import(pathToFileURL(resolve(directory, 'sirius-viewer.js')).href)
  const data = readFileSync(resolve(directory, 'sirius-viewer.data'))
  const wasm = readFileSync(resolve(directory, 'sirius-viewer.wasm'))
  server = createServer((request, response) => {
    if (request.url !== '/sirius-viewer.wasm') { response.writeHead(404).end(); return }
    response.writeHead(200, { 'Content-Type': 'application/wasm' }).end(wasm)
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  module = await create({
    locateFile: file => `http://127.0.0.1:${server.address().port}/${file}`,
    getPreloadedPackage: () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  })
  assert.equal(module._wv_init(1280, 720), 1)
  module._wv_clear_texture_queues()
  module.FS.mkdirTree('/tests')
})

function load(text, extension = 'csv') {
  const path = `/tests/chart.${extension}`
  module.FS.writeFile(path, text)
  return module.ccall('wv_load_chart', 'number', ['string', 'string'], [path, ''])
}
function expectLoad(text, extension) {
  assert.equal(load(text, extension), 1, module.UTF8ToString(module._wv_last_error()))
}
function frame(milliseconds) {
  module._wv_frame(milliseconds * 1000, 0, ++generation, 0, 0)
  const offset = module._wv_vertices() / 4
  const vertices = Array.from(module.HEAPF32.subarray(offset, offset + module._wv_vertex_count() * 10))
  assert(vertices.length > 0 && vertices.every(Number.isFinite), 'frame contains finite render geometry')
  assert(module._wv_command_count() > 0)
  return vertices
}

test('CSV preview accepts left/right overhang and notes wider than twelve lanes', () => {
  expectLoad('1,-1,10,-1,5,0,0\n2,-1,10,11,6,0,0\n3,-1,10,-2,19,0,0\n')
  assert.equal(module._wv_note_count(), 3)
  for (const time of [800, 1800, 2800, 4000]) frame(time)
  assert.equal(module._wv_combo(), 3)
  // A wide note must keep different geometry from a clamped twelve-lane note.
  expectLoad('1,-1,10,-2,19,0,0\n')
  const wide = frame(800)
  expectLoad('1,-1,10,1,12,0,0\n')
  assert.notDeepEqual(frame(800), wide)
})

test('all nontail hold variants count only authored judgments, with no synthetic tails or eighths', () => {
  const holds = [1100, 1101, 1110, 1111].map((type, i) => `1,2,${type},${1 + i * 3},3,0,0\n`).join('')
  expectLoad(holds)
  frame(1500)
  frame(3000)
  assert.equal(module._wv_note_count(), 4)
  assert.equal(module._wv_combo(), 0)
  const judgments = [1, 4, 7, 10].map(lane => `1.5,-1,900,${lane},3,0,0\n`).join('')
  expectLoad(holds + judgments)
  frame(3000)
  assert.equal(module._wv_note_count(), 8)
  assert.equal(module._wv_combo(), 4)
})

test('SV changes rendered ribbon geometry without changing judgment timing and clears on next chart', () => {
  const hold = '1,3,100,3,4,0,0\n'
  expectLoad(hold)
  const ordinary = frame(1500)
  assert.equal(module._wv_combo(), 0)
  expectLoad('0,0.5,-1,0,0,0,0\n2,2,-1,0,0,0,0\n' + hold)
  assert.notDeepEqual(frame(1500), ordinary)
  assert.equal(module._wv_combo(), 0)
  frame(3100)
  assert.equal(module._wv_combo(), 1)
  expectLoad(hold)
  assert.deepEqual(frame(1500), ordinary, 'previous SV timeline cannot leak into the next chart')
})

test('Refresh wdschart v6 preserves authored nontail judgments and scroll events', () => {
  expectLoad(`WDSCHART 6
BPM 60
TPQ 480
TIMING 0
PROFILE SiriusExtended
NOTES 2
N 0 480 960 1100 -2 5 0 0 -1
N 1 720 0 900 -2 5 0 -2147483647 0
SUPPRESSED_EIGHTHS 0
SPEEDS 1
S 0 0.5
CONCURRENT 0
END
`, 'wdschart')
  assert.equal(module._wv_note_count(), 2)
  frame(1500)
  frame(3000)
  assert.equal(module._wv_combo(), 1)
})

test('invalid geometry and SV still fail, and ordinary charts load after failures', () => {
  for (const text of ['1,-1,10,14,3,0,0\n', '1,-1,10,-5,2,0,0\n',
    '0,0,-1,0,0,0,0\n', '0,-2,-1,0,0,0,0\n', '0,nan,-1,0,0,0,0\n']) {
    assert.equal(load(text), 0, text)
    assert(module.UTF8ToString(module._wv_last_error()).length > 0)
  }
  expectLoad('1,-1,10,1,2,0,0\n')
  frame(2000)
  assert.equal(module._wv_combo(), 1)
})
