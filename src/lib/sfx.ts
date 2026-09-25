// Executes the SFX commands recorded by native/shim/wds/audio/audio_engine.hpp
// (upstream PlaybackPreviewView decides *what* to play and *when*; this only plays).

import type { AudioTransport } from './audioTransport'
import type { ViewerModule } from './wasm'

// wds::audio::HitSfxClip order → file (audio-player/src/audio_engine.cpp filename_for).
const CLIP_FILES = [
  '_PERFECT.ogg', // Perfect
  '_PERFECT_ALTERNATIVE.ogg', // Great
  '_GOOD.ogg', // Good
  '_GOOD_ALTERNATIVE.ogg', // Bad
  'Sirius Scratch.ogg', // Scratch
  'Sirius Critical.ogg', // Critical
  'Sirius Sound.ogg', // Sound
  '_HOLD.ogg', // Hold
  '_STAGE.ogg', // Stage
]
const CLIP_HOLD = 7

const enum Cmd {
  Play = 0,
  ScheduleAt = 1,
  StopAll = 2,
  HoldLoop = 3,
  HoldGate = 4,
  ClearHoldGates = 5,
}

// WebSfxCommand: int32 kind, int32 clip, double music_us → 16 bytes.
const COMMAND_BYTES = 16
// A hit whose schedule time is further in the past than this is dropped.
const LATE_TOLERANCE_SEC = 0.05

interface HoldLoopRegion {
  start: number
  end: number
}

export class SfxPlayer {
  private readonly buffers: (AudioBuffer | null)[] = []
  private holdRegion: HoldLoopRegion | null = null
  private readonly active = new Set<AudioBufferSourceNode>()
  private hold: AudioBufferSourceNode | null = null
  ready = false

  constructor(private readonly transport: AudioTransport) {}

  async load(baseUrl: string) {
    const ctx = this.transport.ctx
    const fetchBuffer = async (name: string) => {
      try {
        const res = await fetch(new URL(encodeURIComponent(name), baseUrl))
        if (!res.ok) return null
        return await ctx.decodeAudioData(await res.arrayBuffer())
      } catch {
        return null
      }
    }
    const [buffers, region] = await Promise.all([
      Promise.all(CLIP_FILES.map(fetchBuffer)),
      fetch(new URL('hold_loop.json', baseUrl))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
    this.buffers.splice(0, this.buffers.length, ...buffers)
    if (region && region.end_ms > region.start_ms) {
      this.holdRegion = { start: region.start_ms / 1000, end: region.end_ms / 1000 }
    }
    this.ready = true
  }

  /** Drain and execute this frame's commands. */
  process(m: ViewerModule) {
    const count = m._wv_sfx_command_count()
    if (count === 0) return
    const base = m._wv_sfx_commands()
    for (let i = 0; i < count; i++) {
      const p = base + i * COMMAND_BYTES
      const kind = m.HEAP32[p >> 2]
      const clip = m.HEAP32[(p >> 2) + 1]
      const musicUs = m.HEAPF64[(p >> 3) + 1]
      this.execute(kind, clip, musicUs)
    }
    m._wv_clear_sfx_commands()
  }

  stopAll() {
    for (const src of this.active) this.stopSource(src)
    this.active.clear()
    this.setHold(false)
  }

  private execute(kind: number, clip: number, musicUs: number) {
    switch (kind) {
      case Cmd.Play:
        this.playClip(clip, this.transport.ctx.currentTime)
        break
      case Cmd.ScheduleAt: {
        const when = this.transport.ctxTimeFor(musicUs / 1e6)
        const now = this.transport.ctx.currentTime
        if (when < now - LATE_TOLERANCE_SEC) break
        this.playClip(clip, Math.max(when, now))
        break
      }
      case Cmd.StopAll:
        this.stopAll()
        break
      case Cmd.HoldLoop:
        this.setHold(clip !== 0)
        break
      // Hold gates only sharpen hold-loop edges between frames; the per-frame
      // HoldLoop state already tracks hold bodies, so gates are ignored.
      case Cmd.HoldGate:
      case Cmd.ClearHoldGates:
        break
    }
  }

  private playClip(clip: number, when: number) {
    if (clip === CLIP_HOLD) return
    const buffer = this.buffers[clip]
    if (!buffer) return
    const src = this.transport.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.transport.sfxGain)
    src.onended = () => {
      this.active.delete(src)
      src.disconnect()
    }
    src.start(when)
    this.active.add(src)
  }

  private setHold(enabled: boolean) {
    if (!enabled) {
      if (this.hold) this.stopSource(this.hold)
      this.hold = null
      return
    }
    if (this.hold) return
    const buffer = this.buffers[CLIP_HOLD]
    if (!buffer) return
    const src = this.transport.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    // Official Basic1_hold loops a region after the attack (hold_loop.json).
    if (this.holdRegion && this.holdRegion.end <= buffer.duration) {
      src.loopStart = this.holdRegion.start
      src.loopEnd = this.holdRegion.end
    }
    src.connect(this.transport.sfxGain)
    src.start()
    this.hold = src
  }

  private stopSource(src: AudioBufferSourceNode) {
    try {
      src.stop()
    } catch {
      // not started
    }
    src.disconnect()
  }
}
