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
  /** Song jacket image, shown on the screens behind the stage. */
  cover?: ChartSource | null
  /** URL containing `wasm/` and `effects/` from the package's `assets/` directory. */
  assetBase?: string
  /** Start playing as soon as everything is loaded (subject to browser autoplay rules). */
  autoplay?: boolean
  /** Host is still fetching sources; all playback stays blocked until false. */
  pending?: boolean
  /** fetch() options for URL sources (e.g. auth headers). */
  fetchInit?: RequestInit
}>(), {
  chart: null,
  chartName: '',
  music: null,
  musicConfig: null,
  cover: null,
  assetBase: '/sirius-chart-viewer/',
  autoplay: false,
  pending: false,
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
const loadStage = ref('正在初始化预览引擎与音效…')
const loadProgress = ref<number | null>(null)
const error = ref('')
const chartInfo = ref<ChartInfo>()
const showSettings = ref(false)
const fakeFullscreen = ref(false)
const nativeFullscreen = ref(false)

const time = ref(0)
const duration = ref(0)
const startTime = ref(0)
const playing = ref(false)
const combo = ref(0)
let uiRaf = 0
let disposed = false

const hasChart = computed(() => !!chartInfo.value)
const canPlay = computed(() => engineReady.value && hasChart.value && !loading.value && !props.pending && !error.value && !disposed)
const isFullscreen = computed(() => nativeFullscreen.value || fakeFullscreen.value)
const seekMax = computed(() => Math.max(duration.value, startTime.value + 0.01))
const seekPercent = computed(() => {
  const span = seekMax.value - startTime.value
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((time.value - startTime.value) / span) * 100))
})

const loadingMessage = computed(() => {
  if (!engineReady.value) return '正在初始化预览引擎与音效…'
  if (props.pending) return '正在等待谱面与媒体资源…'
  return loadStage.value
})

const loadingSubtext = computed(() => {
  if (!engineReady.value) return '首次加载需下载 WebAssembly 核心与打击音效'
  if (props.pending) return '等待外部数据源就绪'
  if (loadProgress.value !== null) return `${Math.round(loadProgress.value)}%`
  return '请稍候'
})

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

function describeTargets() {
  const parts: string[] = []
  if (props.chart) parts.push('谱面')
  if (props.music) parts.push('音乐')
  if (props.cover) parts.push('封面')
  if (props.musicConfig) parts.push('配置')
  return parts.length ? parts.join('、') : '资源'
}

// Every generation is a complete source set. A slow retired load can never
// unlock playback or publish a loaded event for a newer selection.
let generation = 0
let running = false
let request: AbortController | null = null

function reload() {
  generation++
  request?.abort()
  viewer.value?.transport.pause()
  playing.value = false
  loading.value = true
  loadProgress.value = null
  loadStage.value = `正在读取${describeTargets()}…`
  error.value = ''
  if (!viewer.value || running || props.pending || disposed) return
  void runReload()
}

async function runReload() {
  running = true
  try {
    while (!disposed && !props.pending) {
      const version = generation
      const v = viewer.value!
      const controller = new AbortController()
      request = controller
      const current = () => !disposed && version === generation && !props.pending
      const init = {
        ...props.fetchInit,
        signal: props.fetchInit?.signal
          ? AbortSignal.any([controller.signal, props.fetchInit.signal])
          : controller.signal,
      }
      const chartSource = props.chart
      const name = props.chartName || sourceName(chartSource) || 'chart.csv'
      const hasAnySource = !!(chartSource || props.musicConfig || props.music || props.cover)
      try {
        if (hasAnySource) {
          loadStage.value = `正在读取${describeTargets()}…`
          loadProgress.value = 15
        }
        const [data, config, audio, jacket] = await Promise.all([
          chartSource ? readSource(chartSource, init) : null,
          props.musicConfig ? readSource(props.musicConfig, init) : undefined,
          props.music ? readSource(props.music, init) : null,
          props.cover ? readSource(props.cover, init) : null,
        ])
        if (!current()) continue

        if (audio || jacket) {
          loadStage.value = audio && jacket
            ? '正在解码音频并处理封面…'
            : audio
              ? '正在解码音频…'
              : '正在处理封面图像…'
          loadProgress.value = 55
        }
        await Promise.all([v.loadMusic(audio), v.setCover(jacket)])
        if (!current()) continue

        if (data) {
          loadStage.value = '正在解析谱面数据…'
          loadProgress.value = 88
        }
        chartInfo.value = data ? v.loadChart({ name, data, musicConfig: config }) : undefined
        loadProgress.value = 100
        loading.value = false
        if (chartInfo.value) emit('loaded', chartInfo.value)
        if (current() && props.autoplay) await play()
      } catch (e) {
        if (current()) {
          loading.value = false
          loadProgress.value = null
          fail(e)
        }
      }
      if (current()) break
    }
  } finally {
    running = false
    request = null
  }
}

watch(
  () => [props.chart, props.chartName, props.musicConfig, props.music, props.cover, props.pending, props.fetchInit],
  reload,
  { flush: 'sync' },
)

async function play() {
  const v = viewer.value
  if (!v || !canPlay.value) return
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
  if (canPlay.value) viewer.value?.transport.seek(t)
}

function onSeekInput(e: Event) {
  seek(Number((e.target as HTMLInputElement).value))
}

function onKey(e: KeyboardEvent) {
  const v = viewer.value
  if (!v) return
  if (e.code === 'Escape' && showSettings.value) {
    showSettings.value = false
    return
  }
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

function onFullscreenChange() {
  nativeFullscreen.value = typeof document !== 'undefined' && !!document.fullscreenElement
}

function toggleFullscreen() {
  const el = root.value
  if (!el) return
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else if (fakeFullscreen.value) {
    fakeFullscreen.value = false
  } else if (el.requestFullscreen) {
    el.requestFullscreen()
      .then(() => {
        // Phones: the stage is 16:9, so rotate to landscape where supported (Android Chrome).
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
        if (matchMedia('(pointer: coarse)').matches) orientation?.lock?.('landscape').catch(() => {})
      })
      .catch(() => (fakeFullscreen.value = true))
  } else {
    // iOS Safari has no element fullscreen: fill the viewport instead.
    fakeFullscreen.value = true
  }
}

let instance: ChartViewer | null = null

onMounted(async () => {
  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', onFullscreenChange)
  }
  uiRaf = requestAnimationFrame(syncUi)
  try {
    const v = new ChartViewer(canvas.value!)
    instance = v
    v.transport.onEnded = () => emit('ended')
    await v.init(props.assetBase)
    if (disposed) return
    viewer.value = v
    applySettings()
    engineReady.value = true
    emit('ready')
    loading.value = false
    reload()
  } catch (e) {
    loading.value = false
    if (!disposed) fail(e)
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  }
  disposed = true
  generation++
  request?.abort()
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

      <div v-if="loading || pending" class="scv__overlay scv__overlay--dim" role="status" aria-live="polite">
        <div class="scv__loader-card">
          <div class="scv__spinner-wrap" aria-hidden="true">
            <span class="scv__spinner" />
            <span class="scv__spinner scv__spinner--inner" />
          </div>
          <div class="scv__loader-copy">
            <div class="scv__loader-title">{{ loadingMessage }}</div>
            <div class="scv__loader-sub">{{ loadingSubtext }}</div>
          </div>
          <div class="scv__loader-bar" aria-hidden="true">
            <div
              class="scv__loader-fill"
              :class="{ 'is-indeterminate': loadProgress === null || pending || !engineReady }"
              :style="loadProgress !== null && !pending && engineReady ? { width: `${loadProgress}%` } : undefined"
            />
          </div>
        </div>
      </div>

      <div v-else-if="engineReady && !hasChart && !error" class="scv__overlay scv__overlay--empty">
        <slot name="empty">没有谱面</slot>
      </div>

      <button
        v-else-if="canPlay && !playing"
        class="scv__big-play"
        type="button"
        aria-label="播放"
        @click="play"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5-11-6.5z" />
        </svg>
      </button>

      <div v-if="error" class="scv__error" role="alert">
        <svg class="scv__error-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4m0 4h.01" stroke-linecap="round" />
        </svg>
        <span class="scv__error-text">{{ error }}</span>
        <button v-if="engineReady" class="scv__retry" type="button" @click="reload">重试加载</button>
      </div>

      <SettingsPanel v-if="showSettings" v-model="settings" class="scv__settings" @close="showSettings = false" />
    </section>

    <footer class="scv__controls">
      <button class="scv__play" type="button" :disabled="!canPlay" :aria-label="playing ? '暂停' : '播放'" @click="toggle">
        <svg v-if="playing" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1.2" />
          <rect x="14" y="5" width="4" height="14" rx="1.2" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true" style="margin-left: 2px">
          <path d="M7.5 5.5v13l11-6.5-11-6.5z" />
        </svg>
      </button>

      <span class="scv__time">{{ formatTime(time) }}</span>

      <input
        class="scv__seek"
        type="range"
        aria-label="进度"
        :min="startTime"
        :max="seekMax"
        step="0.01"
        :value="time"
        :disabled="!canPlay"
        :style="{ '--seek-pct': `${seekPercent}%` }"
        @input="onSeekInput"
      />

      <span class="scv__time scv__time--total">{{ formatTime(duration) }}</span>

      <span v-if="chartInfo" class="scv__meta" title="当前 Combo / 总 Note 数">
        <span class="scv__meta-val">{{ combo }}</span>
        <span class="scv__meta-sep">/</span>
        <span>{{ chartInfo.noteCount }}</span>
      </span>

      <select v-model.number="settings.playbackRate" class="scv__rate" aria-label="播放速度">
        <option :value="0.5">0.5×</option>
        <option :value="0.75">0.75×</option>
        <option :value="1">1.0×</option>
        <option :value="1.25">1.25×</option>
        <option :value="1.5">1.5×</option>
        <option :value="2">2.0×</option>
      </select>

      <button
        class="scv__btn"
        type="button"
        :class="{ 'is-active': showSettings }"
        aria-label="设置"
        title="显示与声音设置"
        @click="showSettings = !showSettings"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <button
        class="scv__btn"
        type="button"
        :class="{ 'is-active': isFullscreen }"
        :aria-label="isFullscreen ? '退出全屏' : '全屏'"
        :title="isFullscreen ? '退出全屏 (F)' : '全屏 (F)'"
        @click="toggleFullscreen"
      >
        <svg v-if="isFullscreen" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.scv {
  --bg: #090a10;
  --panel: #121420;
  --panel-2: #1a1d2e;
  --panel-glass: rgba(16, 18, 30, 0.86);
  --border: rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.16);
  --text: #eef0f8;
  --muted: #8f95b2;
  --accent: #7c8cff;
  --accent-2: #5c6ef2;
  --accent-glow: rgba(124, 140, 255, 0.32);
  --danger: #ff6b7a;
  container-type: inline-size;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 180px;
  background: radial-gradient(circle at 50% 35%, rgba(124, 140, 255, 0.08), transparent 60%), #05060a;
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
  color: var(--muted);
  text-align: center;
  padding: 20px;
  pointer-events: none;
}
.scv__overlay--empty {
  pointer-events: auto;
}
.scv__overlay--dim {
  background: rgba(6, 7, 13, 0.68);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text);
  z-index: 3;
  animation: scv-fade-in 0.18s ease;
}
.scv__loader-card {
  width: min(320px, 90%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 22px 24px 20px;
  border-radius: 16px;
  background: rgba(18, 21, 35, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(124, 140, 255, 0.08) inset;
}
.scv__spinner-wrap {
  position: relative;
  width: 40px;
  height: 40px;
}
.scv__spinner {
  position: absolute;
  inset: 0;
  border: 2.5px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: scv-spin 0.85s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
}
.scv__spinner--inner {
  inset: 7px;
  border-width: 2px;
  border-top-color: transparent;
  border-bottom-color: #a8b4ff;
  animation-duration: 1.25s;
  animation-direction: reverse;
}
@keyframes scv-spin {
  to {
    transform: rotate(360deg);
  }
}
.scv__loader-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.scv__loader-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.scv__loader-sub {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.scv__loader-bar {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.09);
  overflow: hidden;
}
.scv__loader-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent-2), #9aa7ff);
  transition: width 0.25s ease;
}
.scv__loader-fill.is-indeterminate {
  width: 42%;
  animation: scv-indeterminate 1.2s ease-in-out infinite;
}
@keyframes scv-indeterminate {
  0% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(260%);
  }
}
.scv__big-play {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 68px;
  height: 68px;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: linear-gradient(135deg, rgba(124, 140, 255, 0.92), rgba(92, 110, 242, 0.92));
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.55), 0 0 28px var(--accent-glow);
  color: #fff;
  padding-left: 3px;
  transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}
.scv__big-play:hover {
  transform: translate(-50%, -50%) scale(1.07);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6), 0 0 36px rgba(124, 140, 255, 0.5);
  filter: brightness(1.06);
}
.scv__big-play:active {
  transform: translate(-50%, -50%) scale(0.98);
}
.scv__error {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  max-width: min(560px, 92%);
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(52, 18, 28, 0.94);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 107, 122, 0.55);
  color: #ffdce1;
  padding: 10px 14px;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  z-index: 4;
}
.scv__error-icon {
  flex: none;
  color: var(--danger);
}
.scv__error-text {
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}
.scv__retry {
  flex: none;
  margin-left: 4px;
  background: rgba(255, 107, 122, 0.18);
  border: 1px solid rgba(255, 107, 122, 0.45);
  color: #fff;
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.15s ease;
}
.scv__retry:hover {
  background: rgba(255, 107, 122, 0.32);
}
.scv__settings {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(312px, 100%);
  z-index: 5;
  animation: scv-slide-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.scv__controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  padding-bottom: max(9px, env(safe-area-inset-bottom));
  background: var(--panel);
  border-top: 1px solid var(--border);
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.28);
}
.scv__play {
  flex: none;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  box-shadow: 0 3px 12px rgba(92, 110, 242, 0.35);
  transition: transform 0.15s ease, filter 0.15s ease, opacity 0.15s ease;
}
.scv__play:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: scale(1.04);
}
.scv__play:active:not(:disabled) {
  transform: scale(0.96);
}
.scv__play:disabled {
  opacity: 0.35;
  cursor: default;
  box-shadow: none;
}
.scv__time {
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
  min-width: 46px;
  text-align: center;
}
.scv__seek {
  --seek-pct: 0%;
  flex: 1;
  min-width: 60px;
  height: 20px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}
.scv__seek:disabled {
  opacity: 0.4;
  cursor: default;
}
.scv__seek::-webkit-slider-runnable-track {
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--accent) 0%,
    var(--accent) var(--seek-pct),
    rgba(255, 255, 255, 0.14) var(--seek-pct),
    rgba(255, 255, 255, 0.14) 100%
  );
}
.scv__seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -4.5px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.scv__seek:hover:not(:disabled)::-webkit-slider-thumb {
  transform: scale(1.18);
  box-shadow: 0 0 0 4px rgba(124, 140, 255, 0.25);
}
.scv__seek::-moz-range-track {
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
}
.scv__seek::-moz-range-progress {
  height: 5px;
  border-radius: 999px;
  background: var(--accent);
}
.scv__seek::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.scv__meta {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
}
.scv__meta-val {
  color: var(--text);
  font-weight: 600;
}
.scv__meta-sep {
  margin: 0 2px;
  opacity: 0.5;
}
.scv__rate {
  height: 34px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 8px;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.scv__rate:hover {
  border-color: var(--border-strong);
  background: #21253a;
}
.scv__btn {
  flex: none;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.scv__btn:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: #21253a;
}
.scv__btn.is-active {
  border-color: rgba(124, 140, 255, 0.65);
  background: rgba(124, 140, 255, 0.14);
  color: var(--accent);
}
@keyframes scv-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes scv-slide-in {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
@container (max-width: 560px) {
  .scv__meta,
  .scv__time--total {
    display: none;
  }
  .scv__controls {
    gap: 7px;
    padding-left: 10px;
    padding-right: 10px;
  }
}
@container (max-width: 380px) {
  .scv__rate {
    display: none;
  }
}
</style>
