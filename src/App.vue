<script setup lang="ts">
// Standalone page: drop files (or pass ?chart=&music=&config= URLs) into the embeddable player.
import { onMounted, ref, shallowRef } from 'vue'
import SiriusChartViewer from './components/SiriusChartViewer.vue'
import type { ChartSource } from './lib/viewer'

const AUDIO_EXT = /\.(ogg|mp3|wav|m4a|aac|flac|opus|webm)$/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)$/i
const assetBase = import.meta.env.BASE_URL

const chart = shallowRef<ChartSource | null>(null)
const chartName = ref('')
const music = shallowRef<ChartSource | null>(null)
const musicName = ref('')
const musicConfig = shallowRef<ChartSource | null>(null)
const configName = ref('')
const cover = shallowRef<ChartSource | null>(null)
const coverName = ref('')
const dragging = ref(false)
const player = ref<InstanceType<typeof SiriusChartViewer>>()

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
        <img src="/logo.png" alt="" />
        <span>Sirius Chart Viewer</span>
      </div>
      <div class="files">
        <span v-if="chartName" class="chip" :title="chartName">谱面 · {{ chartName }}</span>
        <span v-if="musicName" class="chip" :title="musicName">音乐 · {{ musicName }}</span>
        <span v-if="configName" class="chip" :title="configName">配置 · {{ configName }}</span>
        <span v-if="coverName" class="chip" :title="coverName">封面 · {{ coverName }}</span>
        <label class="btn primary">
          打开文件
          <input
            type="file"
            multiple
            hidden
            accept=".wdschart,.csv,.sus,.txt,audio/*,.ogg,.mp3,.wav,.m4a,.flac,image/*"
            @change="onPick"
          />
        </label>
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
          <div class="hint">
            <p class="big">把谱面拖到这里</p>
            <p>
              支持 <code>.wdschart</code> / 官方 <code>.csv</code> / <code>.sus</code>，可同时拖入音乐、封面图和
              <code>music_config.csv</code>
            </p>
          </div>
        </template>
      </SiriusChartViewer>
      <div v-if="dragging" class="drop">松开以加载</div>
    </main>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.brand img {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}
.files {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.chip {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--muted);
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 10px;
}
.btn {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 12px;
  white-space: nowrap;
  cursor: pointer;
}
.btn.primary {
  background: var(--accent-2);
  border-color: var(--accent-2);
}
.body {
  position: relative;
  flex: 1;
  min-height: 0;
}
.hint .big {
  font-size: 22px;
  color: var(--text);
  margin: 0 0 8px;
}
code {
  background: var(--panel-2);
  padding: 1px 5px;
  border-radius: 4px;
}
.drop {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(124, 140, 255, 0.18);
  border: 2px dashed var(--accent);
  font-size: 20px;
  pointer-events: none;
}
@media (max-width: 640px) {
  .brand span,
  .chip {
    display: none;
  }
}
</style>
