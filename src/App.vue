<script setup lang="ts">
// Standalone page: drop files (or pass ?chart=&music=&config= URLs) into the embeddable player.
import { onMounted, ref, shallowRef } from 'vue'
import AboutModal from './components/AboutModal.vue'
import SiriusChartViewer from './components/SiriusChartViewer.vue'
import { useI18n } from './lib/i18n'
import { PROJECT_INFO } from './lib/projectInfo'
import type { ChartSource } from './lib/viewer'

const { locale, t, toggleLocale } = useI18n()

const AUDIO_EXT = /\.(ogg|mp3|wav|m4a|aac|flac|opus|webm)$/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)$/i
const assetBase = import.meta.env.BASE_URL
const logoUrl = `${assetBase}logo.png`

const chart = shallowRef<ChartSource | null>(null)
const chartName = ref('')
const music = shallowRef<ChartSource | null>(null)
const musicName = ref('')
const musicConfig = shallowRef<ChartSource | null>(null)
const configName = ref('')
const cover = shallowRef<ChartSource | null>(null)
const coverName = ref('')
const dragging = ref(false)
const showAbout = ref(false)
const player = ref<InstanceType<typeof SiriusChartViewer>>()
const fileInput = ref<HTMLInputElement>()

function loadFiles(files: File[]) {
  const audio = files.find((f) => AUDIO_EXT.test(f.name))
  const config = files.find((f) => /music_config/i.test(f.name) && !AUDIO_EXT.test(f.name))
  const image = files.find((f) => IMAGE_EXT.test(f.name))
  const chartFile = files.find((f) => f !== audio && f !== config && f !== image)
  if (image) {
    cover.value = image
    coverName.value = image.name
  }
  if (audio) {
    music.value = audio
    musicName.value = audio.name
  }
  if (config) {
    musicConfig.value = config
    configName.value = config.name
  }
  if (chartFile) {
    chart.value = chartFile
    chartName.value = chartFile.name
  }
}

function clearSource(kind: 'music' | 'config' | 'cover') {
  if (kind === 'music') {
    music.value = null
    musicName.value = ''
  } else if (kind === 'config') {
    musicConfig.value = null
    configName.value = ''
  } else {
    cover.value = null
    coverName.value = ''
  }
}

function openPicker() {
  fileInput.value?.click()
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) loadFiles([...input.files])
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) loadFiles([...files])
}

function urlName(url: string) {
  return decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() ?? '')
}

// ?chart=<url>&music=<url>&config=<music_config url>&cover=<jacket url>&name=<chart file name>&t=<seconds>
let startAt = 0
onMounted(() => {
  const q = new URLSearchParams(window.location.search)
  const chartUrl = q.get('chart')
  if (!chartUrl) return
  const musicUrl = q.get('music')
  const configUrl = q.get('config')
  const coverUrl = q.get('cover')
  if (coverUrl) {
    cover.value = coverUrl
    coverName.value = urlName(coverUrl)
  }
  if (musicUrl) {
    music.value = musicUrl
    musicName.value = urlName(musicUrl)
  }
  if (configUrl) {
    musicConfig.value = configUrl
    configName.value = urlName(configUrl)
  }
  chartName.value = q.get('name') ?? urlName(chartUrl)
  chart.value = chartUrl
  startAt = Number(q.get('t')) || 0
})

function onLoaded() {
  if (startAt) {
    player.value?.seek(startAt)
    startAt = 0
  }
}
</script>

<template>
  <div
    class="app"
    @dragover.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <header class="topbar">
      <div class="brand">
        <img :src="logoUrl" alt="Sirius Chart Viewer" />
        <div class="brand__text">
          <span class="brand__name">{{ PROJECT_INFO.name }}</span>
          <span class="brand__ver">v{{ PROJECT_INFO.version }}</span>
        </div>
      </div>

      <div class="files">
        <div class="chips">
          <span v-if="chartName" class="chip chip--chart" :title="chartName">
            <span class="chip__dot" />
            <span class="chip__text">{{ t.app.chipChart }} · {{ chartName }}</span>
          </span>
          <span v-if="musicName" class="chip chip--music" :title="musicName">
            <span class="chip__dot" />
            <span class="chip__text">{{ t.app.chipMusic }} · {{ musicName }}</span>
            <button class="chip__clear" type="button" :title="t.app.removeMusic" :aria-label="t.app.removeMusic" @click="clearSource('music')">×</button>
          </span>
          <span v-if="configName" class="chip chip--config" :title="configName">
            <span class="chip__dot" />
            <span class="chip__text">{{ t.app.chipConfig }} · {{ configName }}</span>
            <button class="chip__clear" type="button" :title="t.app.removeConfig" :aria-label="t.app.removeConfig" @click="clearSource('config')">×</button>
          </span>
          <span v-if="coverName" class="chip chip--cover" :title="coverName">
            <span class="chip__dot" />
            <span class="chip__text">{{ t.app.chipCover }} · {{ coverName }}</span>
            <button class="chip__clear" type="button" :title="t.app.removeCover" :aria-label="t.app.removeCover" @click="clearSource('cover')">×</button>
          </span>
        </div>

        <label class="btn primary">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>{{ t.app.openFiles }}</span>
          <input
            ref="fileInput"
            type="file"
            multiple
            hidden
            accept=".wdschart,.csv,.sus,.txt,audio/*,.ogg,.mp3,.wav,.m4a,.flac,image/*"
            @change="onPick"
          />
        </label>

        <button class="btn lang-btn" type="button" :title="t.app.switchLangTitle" :aria-label="t.app.switchLangTitle" @click="toggleLocale">
          {{ locale === 'zh' ? 'EN' : '中' }}
        </button>

        <button class="btn icon-label" type="button" :title="t.app.aboutTitle" :aria-label="t.app.aboutTitle" @click="showAbout = true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span class="btn__label">{{ t.app.about }}</span>
        </button>
      </div>
    </header>

    <main class="body">
      <SiriusChartViewer
        ref="player"
        :chart="chart"
        :chart-name="chartName"
        :music="music"
        :music-config="musicConfig"
        :cover="cover"
        :asset-base="assetBase"
        @loaded="onLoaded"
      >
        <template #empty>
          <div class="empty-card" role="button" tabindex="0" @click="openPicker" @keydown.enter.prevent="openPicker" @keydown.space.prevent="openPicker">
            <div class="empty-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-6" />
                <path d="m9 15 3-3 3 3" />
              </svg>
            </div>
            <p class="empty-card__title">{{ t.app.emptyTitle }}</p>
            <p class="empty-card__desc">{{ t.app.emptyDesc }}</p>
            <div class="empty-card__formats">
              <code>.wdschart</code>
              <code>.csv</code>
              <code>.sus</code>
              <code>audio/*</code>
              <code>cover</code>
              <code>music_config.csv</code>
            </div>
          </div>
        </template>
      </SiriusChartViewer>

      <Transition name="app-fade">
        <div v-if="dragging" class="drop">
          <div class="drop__box">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{{ t.app.dropHint }}</span>
          </div>
        </div>
      </Transition>
    </main>

    <Transition name="app-fade">
      <AboutModal v-if="showAbout" @close="showAbout = false" />
    </Transition>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
  z-index: 10;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}
.brand img {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.12);
}
.brand__text {
  display: flex;
  align-items: baseline;
  gap: 7px;
}
.brand__name {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.01em;
}
.brand__ver {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.files {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.chips {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 210px;
  font-size: 12px;
  color: #cfd4e8;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
}
.chip__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
.chip--music .chip__dot {
  background: #53d6a2;
}
.chip--config .chip__dot {
  background: #f0b85c;
}
.chip--cover .chip__dot {
  background: #e07cff;
}
.chip__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip__clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-right: -4px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  line-height: 1;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease;
}
.chip__clear:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease, filter 0.15s ease;
}
.btn:hover {
  border-color: var(--border-strong);
  background: #23273d;
}
.btn:active {
  transform: scale(0.98);
}
.btn.primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border-color: rgba(255, 255, 255, 0.14);
  color: #fff;
  box-shadow: 0 3px 12px rgba(92, 110, 242, 0.32);
}
.btn.primary:hover {
  filter: brightness(1.08);
}
.lang-btn {
  min-width: 38px;
  padding: 7px 10px;
  font-size: 12.5px;
  font-weight: 600;
}
.body {
  position: relative;
  flex: 1;
  min-height: 0;
}
.empty-card {
  width: min(440px, 92%);
  padding: 32px 28px;
  border-radius: 20px;
  background: rgba(18, 21, 35, 0.72);
  border: 1px dashed rgba(124, 140, 255, 0.35);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.38);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}
.empty-card:hover {
  border-color: rgba(124, 140, 255, 0.7);
  background: rgba(24, 28, 48, 0.82);
  transform: translateY(-2px);
}
.empty-card__icon {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(124, 140, 255, 0.14);
  border: 1px solid rgba(124, 140, 255, 0.28);
  color: #a6b2ff;
  margin-bottom: 4px;
}
.empty-card__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}
.empty-card__desc {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}
.empty-card__formats {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}
code {
  font-size: 11.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #c2caf6;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
}
.drop {
  position: absolute;
  inset: 10px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(14, 17, 32, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 2px dashed var(--accent);
  pointer-events: none;
  z-index: 20;
}
.drop__box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #dce1ff;
  font-size: 18px;
  font-weight: 600;
}
.app-fade-enter-active,
.app-fade-leave-active {
  transition: opacity 0.18s ease;
}
.app-fade-enter-from,
.app-fade-leave-to {
  opacity: 0;
}
@media (max-width: 720px) {
  .chips {
    display: none;
  }
}
@media (max-width: 520px) {
  .brand__ver,
  .btn__label {
    display: none;
  }
  .topbar {
    padding: 8px 12px;
  }
}
</style>
