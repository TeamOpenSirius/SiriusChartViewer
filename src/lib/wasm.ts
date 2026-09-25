// Typed wrapper around the Emscripten module built from native/ (<assetBase>/wasm/).

export interface EmscriptenFS {
  mkdirTree(path: string): void
  writeFile(path: string, data: Uint8Array | string): void
  unlink(path: string): void
  analyzePath(path: string): { exists: boolean }
}

export interface ViewerModule {
  HEAPU8: Uint8Array
  HEAP32: Int32Array
  HEAPU32: Uint32Array
  HEAPF32: Float32Array
  HEAPF64: Float64Array
  FS: EmscriptenFS
  UTF8ToString(ptr: number): string
  ccall(name: string, ret: 'number' | 'string' | null, argTypes: string[], args: unknown[]): unknown

  _wv_init(w: number, h: number): number
  _wv_last_error(): number
  _wv_chart_offset_ms(): number
  _wv_chart_end_ms(): number
  _wv_note_count(): number
  _wv_combo(): number
  _wv_resize(w: number, h: number): void
  _wv_set_display(speed: number, startOffset: number, heightLevel: number, splitOpacity: number): void
  _wv_set_options(muteHoldBody: number, showJudgmentText: number): void
  _wv_frame(musicUs: number, playing: number, generation: number, audioReady: number, leadUs: number): void

  _wv_vertices(): number
  _wv_vertex_count(): number
  _wv_commands(): number
  _wv_command_count(): number
  _wv_mvp(): number
  _wv_clear_color(): number
  _wv_additive_scissor(): number

  _wv_texture_uploads(): number
  _wv_texture_upload_count(): number
  _wv_texture_deletes(): number
  _wv_texture_delete_count(): number
  _wv_clear_texture_queues(): void

  _wv_sfx_commands(): number
  _wv_sfx_command_count(): number
  _wv_clear_sfx_commands(): void
}

type Factory = (opts: { locateFile(path: string): string }) => Promise<ViewerModule>

const factories = new Map<string, Promise<Factory>>()

/**
 * Instantiate a fresh wasm module. Each viewer gets its own instance: the
 * native side keeps one preview (and its GPU texture ids) per module, so a
 * module cannot be shared between WebGL contexts. The loader script, .wasm and
 * .data are fetched once and served from the HTTP cache afterwards.
 */
export function createViewerModule(wasmBase: string): Promise<ViewerModule> {
  let factory = factories.get(wasmBase)
  if (!factory) {
    factory = import(/* @vite-ignore */ new URL('sirius-viewer.js', wasmBase).href).then(
      (mod: { default: Factory }) => mod.default,
    )
    factories.set(wasmBase, factory)
    factory.catch(() => factories.delete(wasmBase))
  }
  return factory.then((create) => create({ locateFile: (file) => new URL(file, wasmBase).href }))
}

export function lastError(m: ViewerModule): string {
  return m.UTF8ToString(m._wv_last_error())
}
