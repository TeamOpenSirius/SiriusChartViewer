// Web Audio transport: the single clock for music, hit SFX and visuals.
//
// Music time (seconds) is what wds-editor calls the Timeline position: 0 is the
// start of the BGM file, negative values are a silent preroll (chart delay < 0).
// Everything is scheduled on AudioContext time, so SFX line up with the music
// sample-accurately; visuals read the *audible* time (output latency removed).

export class AudioTransport {
  readonly ctx: AudioContext
  readonly musicGain: GainNode
  readonly sfxGain: GainNode

  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private playing = false
  private rate = 1
  /** Music time at `anchorCtx`. */
  private anchorPos = 0
  /** AudioContext time at which the music is at `anchorPos`. */
  private anchorCtx = 0
  private lastReported = 0
  private minTime = 0
  private chartEnd = 0
  /** Bumped on every play / pause / seek (AudioEngine::position_generation). */
  generation = 1

  onEnded: (() => void) | null = null

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    this.musicGain = this.ctx.createGain()
    this.sfxGain = this.ctx.createGain()
    this.musicGain.connect(this.ctx.destination)
    this.sfxGain.connect(this.ctx.destination)
  }

  get isPlaying() {
    return this.playing
  }

  get hasMusic() {
    return this.buffer !== null
  }

  get playbackRate() {
    return this.rate
  }

  get duration() {
    const music = this.buffer?.duration ?? 0
    return Math.max(music, this.chartEnd)
  }

  get startTime() {
    return this.minTime
  }

  async setMusic(data: ArrayBuffer | null) {
    this.stopSource()
    this.buffer = data ? await this.ctx.decodeAudioData(data.slice(0)) : null
    this.restartIfPlaying()
  }

  /** Chart delay (ms) and last-note time (ms), both in music time. */
  setChartTiming(offsetMs: number, chartEndMs: number) {
    this.minTime = Math.min(0, offsetMs / 1000)
    this.chartEnd = chartEndMs / 1000 + 1.5
  }

  setVolume(music: number, sfx: number) {
    this.musicGain.gain.value = music
    this.sfxGain.gain.value = sfx
  }

  setRate(rate: number) {
    const pos = this.position()
    this.rate = Math.min(2, Math.max(0.25, rate))
    this.anchorPos = pos
    this.restartIfPlaying()
  }

  async play() {
    if (this.playing) return
    if (this.ctx.state !== 'running') await this.ctx.resume()
    if (this.anchorPos >= this.duration - 0.05) this.anchorPos = this.minTime
    this.playing = true
    this.startSource()
  }

  pause() {
    if (!this.playing) return
    this.anchorPos = this.position()
    this.playing = false
    this.stopSource()
    this.generation++
  }

  toggle() {
    return this.playing ? (this.pause(), Promise.resolve()) : this.play()
  }

  seek(time: number) {
    this.anchorPos = this.clamp(time)
    this.lastReported = this.anchorPos
    this.restartIfPlaying()
    this.generation++
  }

  /** Current audible music time in seconds. */
  position(): number {
    if (!this.playing) return this.anchorPos
    let t = this.anchorPos + (this.audibleCtxTime() - this.anchorCtx) * this.rate
    // Audible-clock extrapolation can wobble by a fraction of a ms; keep it monotonic.
    if (t < this.lastReported) t = this.lastReported
    this.lastReported = t
    if (t >= this.duration) {
      this.anchorPos = this.duration
      this.playing = false
      this.stopSource()
      this.generation++
      this.onEnded?.()
      return this.anchorPos
    }
    return t
  }

  /** AudioContext time at which music time `musicSec` is (or was) played. */
  ctxTimeFor(musicSec: number) {
    return this.anchorCtx + (musicSec - this.anchorPos) / this.rate
  }

  private audibleCtxTime() {
    const ts = this.ctx.getOutputTimestamp?.()
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.contextTime > 0) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000
    }
    return this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0)
  }

  private clamp(t: number) {
    return Math.min(Math.max(t, this.minTime), this.duration)
  }

  private restartIfPlaying() {
    if (!this.playing) return
    this.stopSource()
    this.startSource()
  }

  private startSource() {
    // Small lead so the first scheduled SFX are not already late.
    this.anchorCtx = this.ctx.currentTime + 0.03
    this.lastReported = this.anchorPos
    this.generation++
    if (!this.buffer) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffer
    src.playbackRate.value = this.rate
    src.connect(this.musicGain)
    if (this.anchorPos >= 0) {
      if (this.anchorPos < this.buffer.duration) src.start(this.anchorCtx, this.anchorPos)
    } else {
      src.start(this.ctxTimeFor(0), 0)
    }
    this.source = src
  }

  private stopSource() {
    if (!this.source) return
    try {
      this.source.stop()
    } catch {
      // never started
    }
    this.source.disconnect()
    this.source = null
  }
}
