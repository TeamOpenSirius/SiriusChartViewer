<script setup lang="ts">
// Embeddable 3D chart player. Pass the chart (and optionally music / music_config)
// as File, Blob, ArrayBuffer, Uint8Array or URL; the player loads it and is ready to play.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import SettingsPanel from './SettingsPanel.vue'
import { useSettings } from '../lib/settings'
import { ChartViewer, readSource, sourceName, type ChartInfo, type ChartSource } from '../lib/viewer'

const props = withDefaults(defineProps<{
  /** Chart file: .wdschart / official .csv / .sus. */
  chart?: ChartSource | null
  /** File name used to detect the format when `chart` has none (Blob / bytes). */
  chartName?: string
  /** BGM (mp3 / ogg / wav / m4a …). Without it the chart plays on a silent clock. */
  music?: ChartSource | null
  /** Official music_config.csv (DelaySeconds), optional. */
  musicConfig?: ChartSource | null
  /** URL containing `wasm/` and `effects/` from the package's `assets/` directory. */
  assetBase?: string
  /** Start playing as soon as everything is loaded (subject to browser autoplay rules). */
  autoplay?: boolean
  /** fetch() options for URL sources (e.g. auth headers). */
  fetchInit?: RequestInit
}>(), {
  chart: null,
  chartName: '',
  music: null,
  musicConfig: null,
  assetBase: '/sirius-chart-viewer/',
  autoplay: false,
  fetchInit: undefined,
})

const emit = defineEmits<{
  ready: []
  loaded: [info: ChartInfo]
  error: [message: string]
  ended: []
}>()

const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const viewer = shallowRef<ChartViewer>()
const settings = useSettings()

const engineReady = ref(false)
const loading = ref(true)
const error = ref('')
const chartInfo = ref<ChartInfo>()
const showSettings = ref(false)
const fakeFullscreen = ref(false)

const time = ref(0)
const duration = ref(0)
const startTime = ref(0)
const playing = ref(false)
const combo = ref(0)
let uiRaf = 0
let disposed = false

const hasChart = computed(() => !!chartInfo.value)

function formatTime(sec: number) {
  const sign = sec < 0 ? '-' : ''
  const s = Math.abs(sec)
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${sign}${m}:${r.toFixed(1).padStart(4, '0')}`
}

function applySettings() {
  const v = viewer.value
  if (!v) return
  v.setDisplay(settings)
  v.setOptions(settings)
  v.transport.setVolume(settings.musicVolume, settings.sfxVolume)
  if (v.transport.playbackRate !== settings.playbackRate) v.transport.setRate(settings.playbackRate)
}
watch(settings, applySettings, { deep: true })

function syncUi() {
  uiRaf = requestAnimationFrame(syncUi)
  const v = viewer.value
  if (!v) return
  time.value = v.transport.position()
  duration.value = v.transport.duration
  startTime.value = v.transport.startTime
  playing.value = v.transport.isPlaying
  combo.value = v.combo
}

function fail(e: unknown) {
  error.value = e instanceof Error ? e.message : String(e)
  emit('error', error.value)
}

async function loadMusic() {
  const v = viewer.value
  if (!v) return
  const bytes = props.music ? await readSource(props.music, props.fetchInit) : null
  await v.loadMusic(bytes)
}

async function loadChart() {
  const v = viewer.value
  if (!v) return
  if (!props.chart) {
    chartInfo.value = undefined
    return
  }
  const [data, musicConfig] = await Promise.all([
    readSource(props.chart, props.fetchInit),
    props.musicConfig ? readSource(props.musicConfig, props.fetchInit) : Promise.resolve(undefined),
  ])
  const name = props.chartName || sourceName(props.chart) || 'chart.csv'
  chartInfo.value = v.loadChart({ name, data, musicConfig })
  emit('loaded', chartInfo.value)
}

// Source changes are coalesced: a change arriving mid-load is picked up by the
// running loop (music before chart so the timeline knows the BGM length).
const dirty = { music: false, chart: false }
let running = false

function reload(parts: { music: boolean; chart: boolean }) {
  dirty.music ||= parts.music
  dirty.chart ||= parts.chart
  if (running || !viewer.value) return
  running = true
  void runReload().finally(() => (running = false))
}

async function runReload() {
  loading.value = true
  error.value = ''
  try {
    while ((dirty.music || dirty.chart) && !disposed) {
      if (dirty.music) {
        dirty.music = false
        await loadMusic()
      } else {
        dirty.chart = false
        await loadChart()
      }
    }
    if (props.autoplay && hasChart.value && !disposed) await play()
  } catch (e) {
    if (!disposed) fail(e)
  } finally {
    loading.value = false
  }
}

watch(() => [props.chart, props.chartName, props.musicConfig], () => reload({ music: false, chart: true }))
watch(() => props.music, () => reload({ music: true, chart: false }))

async function play() {
  const v = viewer.value
  if (!v || !hasChart.value) return
  try {
    await v.transport.play()
  } catch (e) {
    fail(e)
  }
}

function pause() {
  viewer.value?.transport.pause()
}

function toggle() {
  if (playing.value) pause()
  else void play()
}

function seek(t: number) {
  viewer.value?.transport.seek(t)
}

function onSeekInput(e: Event) {
  seek(Number((e.target as HTMLInputElement).value))
}

function onKey(e: KeyboardEvent) {
  const v = viewer.value
  if (!v) return
  if (e.code === 'Space') {
    e.preventDefault()
    toggle()
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault()
    seek(v.transport.position() - (e.shiftKey ? 1 : 5))
  } else if (e.code === 'ArrowRight') {
    e.preventDefault()
    seek(v.transport.position() + (e.shiftKey ? 1 : 5))
  } else if (e.code === 'Home') {
    seek(v.transport.startTime)
  } else if (e.code === 'KeyF') {
    toggleFullscreen()
  }
}

function toggleFullscreen() {
  const el = root.value
  if (!el) return
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else if (fakeFullscreen.value) {
    fakeFullscreen.value = false
  } else if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => (fakeFullscreen.value = true))
  } else {
    // iOS Safari has no element fullscreen: fill the viewport instead.
    fakeFullscreen.value = true
  }
}

let instance: ChartViewer | null = null

onMounted(async () => {
  uiRaf = requestAnimationFrame(syncUi)
  const v = new ChartViewer(canvas.value!)
  instance = v
  v.transport.onEnded = () => emit('ended')
  try {
    await v.init(props.assetBase)
    if (disposed) return
    viewer.value = v
    applySettings()
    engineReady.value = true
    emit('ready')
    loading.value = false
    reload({ music: !!props.music, chart: !!props.chart })
  } catch (e) {
    loading.value = false
    if (!disposed) fail(e)
  }
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(uiRaf)
  instance?.dispose()
  instance = null
  viewer.value = undefined
})

defineExpose({ play, pause, toggle, seek, viewer })
</script>

<template>
  <div ref="root" class="scv" :class="{ 'scv--fake-fs': fakeFullscreen }" tabindex="0" @keydown="onKey">
    <section class="scv__stage">
      <canvas ref="canvas" @click="toggle" @dblclick.stop="toggleFullscreen" />

      <div v-if="loading" class="scv__overlay scv__overlay--dim">
        <span class="scv__spinner" />
        <span>{{ engineReady ? '正在加载谱面…' : '正在加载预览引擎…' }}</span>
      </div>
      <div v-else-if="engineReady && !hasChart && !error" class="scv__overlay">
        <slot name="empty">没有谱面</slot>
      </div>
      <button
        v-else-if="hasChart && !playing && !error"
        class="scv__big-play"
        aria-label="播放"
        @click="play"
      >
        ▶
      </button>
      <div v-if="error" class="scv__error" role="alert" @click="error = ''">{{ error }}</div>

      <SettingsPanel v-if="showSettings" v-model="settings" class="scv__settings" @close="showSettings = false" />
    </section>

    <footer class="scv__controls">
      <button class="scv__play" :disabled="!hasChart" :aria-label="playing ? '暂停' : '播放'" @click="toggle">
        {{ playing ? '❚❚' : '▶' }}
      </button>
      <span class="scv__time">{{ formatTime(time) }}</span>
      <input
        class="scv__seek"
        type="range"
        aria-label="进度"
        :min="startTime"
        :max="Math.max(duration, startTime + 0.01)"
        step="0.01"
        :value="time"
        :disabled="!hasChart"
        @input="onSeekInput"
      />
      <span class="scv__time scv__time--total">{{ formatTime(duration) }}</span>
      <span v-if="chartInfo" class="scv__meta">{{ combo }}/{{ chartInfo.noteCount }}</span>
      <select v-model.number="settings.playbackRate" class="scv__rate" aria-label="播放速度">
        <option :value="0.5">0.5×</option>
        <option :value="0.75">0.75×</option>
        <option :value="1">1×</option>
        <option :value="1.25">1.25×</option>
        <option :value="1.5">1.5×</option>
        <option :value="2">2×</option>
      </select>
      <button class="scv__btn" :class="{ 'is-active': showSettings }" aria-label="设置" @click="showSettings = !showSettings">⚙</button>
      <button class="scv__btn" aria-label="全屏" @click="toggleFullscreen">⛶</button>
    </footer>
  </div>
</template>

<style scoped>
.scv {
  --bg: #0b0c12;
  --panel: #151722;
  --panel-2: #1d2030;
  --border: #2a2e42;
  --text: #e6e8f2;
  --muted: #8a8fa8;
  --accent: #7c8cff;
  --accent-2: #5b6cf0;
  --danger: #ff6b7a;
  container-type: inline-size;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 180px;
  background: #000;
  color: var(--text);
  font-family: system-ui, -apple-system, 'Segoe UI', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  outline: none;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.scv *,
.scv *::before,
.scv *::after {
  box-sizing: border-box;
}
.scv:fullscreen,
.scv--fake-fs {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
}
.scv--fake-fs {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
}
.scv button,
.scv select,
.scv input {
  font: inherit;
  color: inherit;
}
.scv button {
  cursor: pointer;
}
.scv__stage {
  position: relative;
  flex: 1;
  min-height: 0;
}
.scv__stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: manipulation;
}
.scv__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  text-align: center;
  padding: 16px;
  pointer-events: none;
}
.scv__overlay--dim {
  background: rgba(0, 0, 0, 0.5);
  color: var(--text);
}
.scv__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: scv-spin 0.8s linear infinite;
}
@keyframes scv-spin {
  to {
    transform: rotate(360deg);
  }
}
.scv__big-play {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 64px;
  height: 64px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: none;
  background: rgba(91, 108, 240, 0.85);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  font-size: 24px;
  padding-left: 6px;
}
.scv__error {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  max-width: 90%;
  background: #3a1820;
  border: 1px solid var(--danger);
  color: #ffd6db;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}
.scv__settings {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(300px, 100%);
  z-index: 2;
}
.scv__controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  background: var(--panel);
  border-top: 1px solid var(--border);
}
.scv__play {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--accent-2);
  font-size: 13px;
}
.scv__play:disabled {
  opacity: 0.4;
  cursor: default;
}
.scv__time,
.scv__meta {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}
.scv__time {
  min-width: 48px;
  text-align: center;
}
.scv__seek {
  flex: 1;
  min-width: 60px;
  accent-color: var(--accent);
}
.scv__rate {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 4px;
}
.scv__btn {
  flex: none;
  width: 34px;
  height: 34px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 16px;
  line-height: 1;
}
.scv__btn.is-active {
  border-color: var(--accent);
  color: var(--accent);
}
@container (max-width: 560px) {
  .scv__meta,
  .scv__time--total {
    display: none;
  }
  .scv__controls {
    gap: 6px;
    padding-left: 8px;
    padding-right: 8px;
  }
}
@container (max-width: 380px) {
  .scv__rate {
    display: none;
  }
}
</style>
