import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, reactive } from 'vue'
import ts from 'typescript'

const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const source = readFileSync(new URL('../src/components/SiriusChartViewer.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
let code = ts.transpileModule(compileScript(descriptor, { id: 'viewer-test', inlineTemplate: true }).content,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const mocks = url(`
export function readSource(source) { return globalThis.__viewerTest.read(source) }
export function sourceName() { return 'chart.csv' }
export class ChartViewer {
  constructor() { Object.assign(this, globalThis.__viewerTest.engine) }
}
`)
code = code.replaceAll("'../lib/viewer'", `'${mocks}'`)
  .replaceAll("'../lib/settings'", `'${url(`import { reactive } from '${import.meta.resolve('vue')}'; export function useSettings() { return reactive({ playbackRate: 1 }) }`)}'`)
  .replaceAll("'./SettingsPanel.vue'", `'${url('export default { render() { return null } }')}'`)
  .replace(/from ["']vue["']/g, `from '${import.meta.resolve('vue')}'`)
const Viewer = (await import(url(code))).default
const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null, addEventListener() {}, removeEventListener() {}, get options() { return this.children } })
const renderer = createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (n, text) => { n.text = text }, setElementText: (n, text) => { n.text = text; n.children = [] },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  insert(n, parent, anchor = null) { if (n.parent) this.remove(n); n.parent = parent; const i = parent.children.indexOf(anchor); parent.children.splice(i < 0 ? parent.children.length : i, 0, n) },
  remove(n) { const i = n.parent?.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); n.parent = null },
  patchProp: (n, key, _, value) => { n.props[key] = value },
})
const find = (n, predicate) => predicate(n) ? n : n.children.map(c => find(c, predicate)).find(Boolean)
const flush = async () => { for (let i = 0; i < 15; i++) { await Promise.resolve(); await nextTick() } }
function mount(t, initial = {}) {
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = () => {}
  const state = { plays: 0, pauses: 0, charts: [], reads: [], read: async source => { state.reads.push(source); return new Uint8Array([1]) } }
  state.engine = {
    init: async () => {}, setDisplay() {}, setOptions() {}, dispose() {},
    loadMusic: async () => {}, setCover: async () => {},
    loadChart(input) { state.charts.push(input.name); return { noteCount: 1, offsetMs: 0, endMs: 1000 } },
    transport: { playbackRate: 1, setVolume() {}, play: async () => { state.plays++ }, pause: () => { state.pauses++ }, seek() {} },
  }
  globalThis.__viewerTest = state
  const props = reactive({ chart: 'chart', ...initial })
  const root = node('root')
  let exposed
  const app = renderer.createApp({ render: () => h(Viewer, { ...props, ref: value => { exposed = value } }) })
  app.mount(root)
  t.after(() => app.unmount())
  return { state, props, root, exposed: () => exposed, button: () => find(root, n => n.props.class === 'scv__play') }
}

test('slow audio blocks button, canvas, keyboard and exposed play until the entire source set is ready', async t => {
  const audio = deferred()
  const c = mount(t, { music: 'music', cover: 'cover' })
  c.state.read = source => source === 'music' ? audio.promise : Promise.resolve(new Uint8Array([1]))
  await flush()
  assert.equal(c.button().props.disabled, true)
  await c.exposed().play()
  find(c.root, n => n.type === 'canvas').props.onClick()
  find(c.root, n => n.props.tabindex === '0').props.onKeydown({ code: 'Space', preventDefault() {} })
  assert.equal(c.state.plays, 0)
  audio.resolve(new Uint8Array([1]))
  await flush()
  assert.equal(c.button().props.disabled, false)
  await c.exposed().play()
  assert.equal(c.state.plays, 1)
})

test('host pending blocks autoplay and a replacement source waits for cover decoding', async t => {
  const c = mount(t, { pending: true, autoplay: true })
  await flush()
  assert.equal(c.state.plays, 0)
  c.props.pending = false
  await flush()
  assert.equal(c.state.plays, 1)
  const cover = deferred()
  c.state.engine.setCover = () => cover.promise
  // The mock instance holds its methods, so replace the exposed instance too.
  c.exposed().viewer.setCover = () => cover.promise
  c.props.cover = 'new-cover'
  await flush()
  assert.equal(c.button().props.disabled, true)
  await c.exposed().play()
  assert.equal(c.state.plays, 1)
  cover.resolve()
  await flush()
  assert.equal(c.state.plays, 2)
})

test('failed new assets cannot play an older chart and retry reloads all assets', async t => {
  const c = mount(t)
  await flush()
  c.state.read = async () => { throw new Error('network failed') }
  c.props.music = 'bad-music'
  await flush()
  assert.equal(c.button().props.disabled, true)
  await c.exposed().play()
  assert.equal(c.state.plays, 0)
  c.state.read = async () => new Uint8Array([1])
  const alert = find(c.root, n => n.props.role === 'alert')
  find(alert, n => n.type === 'button').props.onClick()
  await flush()
  assert.equal(c.button().props.disabled, false)
})

test('retired chart download cannot publish or autoplay after a newer selection', async t => {
  const old = deferred()
  const c = mount(t, { chartName: 'old.csv', autoplay: true })
  c.state.read = source => source === 'chart' ? old.promise : Promise.resolve(new Uint8Array([2]))
  await flush()
  c.props.chart = 'new-chart'
  c.props.chartName = 'new.csv'
  await flush()
  old.resolve(new Uint8Array([1]))
  await flush()
  assert.deepEqual(c.state.charts, ['new.csv'])
  assert.equal(c.state.plays, 1)
})
