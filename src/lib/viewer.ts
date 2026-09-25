// Glue between the wasm preview core, WebGL2 and Web Audio.

import { AudioTransport } from './audioTransport'
import { GlRenderer } from './glRenderer'
import { SfxPlayer } from './sfx'
import { createViewerModule, lastError, type ViewerModule } from './wasm'

export interface DisplaySettings {
  noteSpeed: number
  noteStartOffset: number
  noteHeightLevel: number
  splitLineOpacity: number
}

export interface ViewerOptions {
  muteHoldBodySfx: boolean
  showJudgmentText: boolean
}

/** Anything a chart / music / music_config file can be passed as. Strings are fetched as URLs. */
export type ChartSource = Blob | ArrayBuffer | ArrayBufferView | string

export interface ChartInput {
  /** File name; its extension selects the parser (.wdschart / .csv / .sus). */
  name: string
  data: Uint8Array
  /** Optional official music_config.csv (DelaySeconds). */
  musicConfig?: Uint8Array
}

export interface ChartInfo {
  noteCount: number
  offsetMs: number
  endMs: number
}

const WORK_DIR = '/work'
// Jacket art is resampled into the stage screens (~450 px wide); larger input only costs time.
const COVER_MAX_SIZE = 1024

function extensionOf(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  return m ? m[1].toLowerCase() : ''
}

/** Resolve a ChartSource to bytes (URLs are fetched with same-origin credentials). */
export async function readSource(source: ChartSource, init?: RequestInit): Promise<Uint8Array> {
  if (typeof source === 'string') {
    const res = await fetch(source, { credentials: 'same-origin', ...init })
    if (!res.ok) throw new Error(`下载失败 ${res.status}: ${source}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer())
  if (source instanceof ArrayBuffer) return new Uint8Array(source)
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
}

/** Best-effort file name for a source (File name or URL path). */
export function sourceName(source: ChartSource | null | undefined): string {
  if (!source) return ''
  if (typeof File !== 'undefined' && source instanceof File) return source.name
  if (typeof source === 'string') {
    try {
      return decodeURIComponent(new URL(source, window.location.href).pathname.split('/').pop() ?? '')
    } catch {
      return ''
    }
  }
  return ''
}

export class ChartViewer {
  readonly transport = new AudioTransport()
  private readonly sfx = new SfxPlayer(this.transport)
  private module: ViewerModule | null = null
  private renderer: GlRenderer | null = null
  private raf = 0
  private fbWidth = 1
  private fbHeight = 1
  private chartLoaded = false
  private disposed = false

  constructor(private readonly canvas: HTMLCanvasElement) {}

  /** assetBase must contain `wasm/` (sirius-viewer.*) and `effects/` (hit SFX). */
  async init(assetBase: string) {
    const base = new URL(assetBase, window.location.href)
    this.renderer = new GlRenderer(this.canvas)
    const [m] = await Promise.all([
      createViewerModule(new URL('wasm/', base).href),
      this.sfx.load(new URL('effects/', base).href),
    ])
    if (this.disposed) return
    this.module = m
    this.measure()
    if (!m._wv_init(this.fbWidth, this.fbHeight)) {
      throw new Error(`预览初始化失败：${lastError(m)}`)
    }
    this.renderer.syncTextures(m)
    this.raf = requestAnimationFrame(this.tick)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.transport.pause()
    this.sfx.stopAll()
    this.renderer?.dispose()
    this.renderer = null
    this.module = null
    void this.transport.ctx.close()
  }

  loadChart(input: ChartInput): ChartInfo {
    const m = this.requireModule()
    try {
      m.FS.mkdirTree(WORK_DIR)
    } catch {
      // exists
    }
    const ext = extensionOf(input.name) || 'csv'
    const chartPath = `${WORK_DIR}/chart.${ext}`
    m.FS.writeFile(chartPath, input.data)
    let configPath = ''
    if (input.musicConfig) {
      configPath = `${WORK_DIR}/music_config.csv`
      m.FS.writeFile(configPath, input.musicConfig)
    }
    const ok = m.ccall('wv_load_chart', 'number', ['string', 'string'], [chartPath, configPath])
    if (!ok) throw new Error(`谱面加载失败：${lastError(m)}`)
    this.chartLoaded = true

    const info: ChartInfo = {
      noteCount: m._wv_note_count(),
      offsetMs: m._wv_chart_offset_ms(),
      endMs: m._wv_chart_end_ms(),
    }
    this.transport.pause()
    this.sfx.stopAll()
    this.transport.setChartTiming(info.offsetMs, info.endMs)
    this.transport.seek(this.transport.startTime)
    return info
  }

  async loadMusic(data: ArrayBuffer | Uint8Array | null) {
    const buffer = data instanceof Uint8Array
      ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
      : data
    await this.transport.setMusic(buffer)
    this.transport.seek(this.transport.position())
  }

  /** Show an image (song jacket) on the screens behind the stage; null restores the skin. */
  async setCover(image: Uint8Array | Blob | null) {
    const m = this.requireModule()
    if (!image) {
      m._wv_set_cover(0, 0, 0)
      return
    }
    const blob = image instanceof Blob ? image : new Blob([image as BlobPart])
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, COVER_MAX_SIZE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const pixels = ctx.getImageData(0, 0, w, h).data
    if (this.module !== m) return
    const ptr = m._malloc(pixels.length)
    try {
      m.HEAPU8.set(pixels, ptr)
      if (!m._wv_set_cover(ptr, w, h)) throw new Error('封面绘制失败')
    } finally {
      m._free(ptr)
    }
  }

  get hasChart() {
    return this.chartLoaded
  }

  get combo() {
    return this.module?._wv_combo() ?? 0
  }

  setDisplay(s: DisplaySettings) {
    this.module?._wv_set_display(s.noteSpeed, s.noteStartOffset, s.noteHeightLevel, s.splitLineOpacity)
  }

  setOptions(o: ViewerOptions) {
    this.module?._wv_set_options(o.muteHoldBodySfx ? 1 : 0, o.showJudgmentText ? 1 : 0)
  }

  private requireModule() {
    if (!this.module) throw new Error('viewer not initialized')
    return this.module
  }

  private measure() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (w === this.fbWidth && h === this.fbHeight) return false
    this.fbWidth = w
    this.fbHeight = h
    this.canvas.width = w
    this.canvas.height = h
    return true
  }

  private readonly tick = () => {
    this.raf = requestAnimationFrame(this.tick)
    const m = this.module
    const r = this.renderer
    if (!m || !r) return
    if (this.measure()) m._wv_resize(this.fbWidth, this.fbHeight)

    const t = this.transport
    const musicUs = Math.round(t.position() * 1e6)
    m._wv_frame(musicUs, t.isPlaying ? 1 : 0, t.generation, this.sfx.ready ? 1 : 0, 0)
    this.sfx.process(m)
    r.draw(m, this.fbWidth, this.fbHeight)
  }
}
