// WebGL2 backend for the frames recorded by native/src/web_renderer.cpp.
//
// Port of wds-editor renderer/shaders/textured_quad.{vert,frag} and the pipeline
// state of VulkanRenderer: no culling, depth never written (so no depth test),
// straight-alpha blending for normal passes and SRC_ALPHA/ONE for the additive
// hit-effect pass, linear/clamp sampling.

import type { ViewerModule } from './wasm'

const VERT = `#version 300 es
uniform mat4 u_mvp;
layout(location = 0) in vec3 in_pos;
layout(location = 1) in vec3 in_uvq;
layout(location = 2) in vec4 in_color;
out vec3 v_uvq;
out vec4 v_color;
void main() {
  gl_Position = u_mvp * vec4(in_pos, 1.0);
  v_uvq = in_uvq;
  v_color = in_color;
}`

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec3 v_uvq;
in vec4 v_color;
out vec4 out_color;
void main() {
  vec2 uv = v_uvq.xy / max(v_uvq.z, 1e-6);
  out_color = texture(u_tex, uv) * v_color;
  if (out_color.a < 0.01) discard;
}`

// DrawVertex: x y z | u*q v*q q | r g b a
const VERTEX_FLOATS = 10
const VERTEX_BYTES = VERTEX_FLOATS * 4
// WebDrawCommand: blend, texture, first_vertex, vertex_count (u32 each)
const COMMAND_U32 = 4
// WebTextureUpload: id, width, height, nearest, pixels* (wasm32)
const UPLOAD_U32 = 5

const BLEND_ADDITIVE = 1

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

export class GlRenderer {
  readonly gl: WebGL2RenderingContext
  private readonly program: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly vbo: WebGLBuffer
  private readonly uMvp: WebGLUniformLocation
  private readonly textures = new Map<number, WebGLTexture>()
  private vboCapacity = 0

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('WebGL2 is not available in this browser')
    this.gl = gl

    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`)
    }
    this.program = program
    this.uMvp = gl.getUniformLocation(program, 'u_mvp')!
    gl.useProgram(program)
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0)

    this.vao = gl.createVertexArray()!
    this.vbo = gl.createBuffer()!
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VERTEX_BYTES, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, VERTEX_BYTES, 12)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, VERTEX_BYTES, 24)

    gl.disable(gl.CULL_FACE)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  }

  /** Apply queued texture creates / deletes from the wasm side. */
  syncTextures(m: ViewerModule) {
    const gl = this.gl
    const deleteCount = m._wv_texture_delete_count()
    if (deleteCount > 0) {
      const base = m._wv_texture_deletes() >>> 2
      for (let i = 0; i < deleteCount; i++) {
        const id = m.HEAPU32[base + i]
        const tex = this.textures.get(id)
        if (tex) gl.deleteTexture(tex)
        this.textures.delete(id)
      }
    }
    const uploadCount = m._wv_texture_upload_count()
    if (uploadCount > 0) {
      const base = m._wv_texture_uploads() >>> 2
      for (let i = 0; i < uploadCount; i++) {
        const o = base + i * UPLOAD_U32
        const id = m.HEAPU32[o]
        const width = m.HEAP32[o + 1]
        const height = m.HEAP32[o + 2]
        const nearest = m.HEAP32[o + 3] !== 0
        const ptr = m.HEAPU32[o + 4]
        // An upload for a live id replaces it (e.g. the stage cover re-composite).
        const previous = this.textures.get(id)
        if (previous) gl.deleteTexture(previous)
        const tex = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, tex)
        const filter = nearest ? gl.NEAREST : gl.LINEAR
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE,
          m.HEAPU8.subarray(ptr, ptr + width * height * 4))
        this.textures.set(id, tex)
      }
    }
    if (deleteCount > 0 || uploadCount > 0) m._wv_clear_texture_queues()
  }

  /** Draw the frame last recorded by wv_frame(). */
  draw(m: ViewerModule, fbWidth: number, fbHeight: number) {
    const gl = this.gl
    this.syncTextures(m)

    gl.viewport(0, 0, fbWidth, fbHeight)
    gl.disable(gl.SCISSOR_TEST)
    const clear = m._wv_clear_color() >>> 2
    gl.clearColor(m.HEAPF32[clear], m.HEAPF32[clear + 1], m.HEAPF32[clear + 2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const vertexCount = m._wv_vertex_count()
    const commandCount = m._wv_command_count()
    if (vertexCount === 0 || commandCount === 0) return

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    const vStart = m._wv_vertices() >>> 2
    const vertices = m.HEAPF32.subarray(vStart, vStart + vertexCount * VERTEX_FLOATS)
    if (vertices.byteLength > this.vboCapacity) {
      this.vboCapacity = Math.max(vertices.byteLength, this.vboCapacity * 2)
      gl.bufferData(gl.ARRAY_BUFFER, this.vboCapacity, gl.STREAM_DRAW)
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices)

    const mvp = m._wv_mvp() >>> 2
    gl.uniformMatrix4fv(this.uMvp, false, m.HEAPF32.subarray(mvp, mvp + 16))

    const sc = m._wv_additive_scissor() >>> 2
    const scissorValid = m.HEAP32[sc] !== 0
    const sx = m.HEAP32[sc + 1]
    const sy = m.HEAP32[sc + 2]
    const sw = m.HEAP32[sc + 3]
    const sh = m.HEAP32[sc + 4]

    gl.activeTexture(gl.TEXTURE0)
    let currentBlend = -1
    let boundTexture = -1
    const cmdBase = m._wv_commands() >>> 2
    for (let i = 0; i < commandCount; i++) {
      const o = cmdBase + i * COMMAND_U32
      const blend = m.HEAPU32[o]
      const textureId = m.HEAPU32[o + 1]
      const first = m.HEAPU32[o + 2]
      const count = m.HEAPU32[o + 3]
      const tex = this.textures.get(textureId)
      if (!tex) continue

      if (blend !== currentBlend) {
        currentBlend = blend
        if (blend === BLEND_ADDITIVE) {
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE)
          if (scissorValid) {
            gl.enable(gl.SCISSOR_TEST)
            // Scissor rect is top-left origin (Vulkan framebuffer space).
            gl.scissor(sx, fbHeight - (sy + sh), sw, sh)
          }
        } else {
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
          gl.disable(gl.SCISSOR_TEST)
        }
      }
      if (textureId !== boundTexture) {
        gl.bindTexture(gl.TEXTURE_2D, tex)
        boundTexture = textureId
      }
      gl.drawArrays(gl.TRIANGLES, first, count)
    }
    gl.disable(gl.SCISSOR_TEST)
  }

  dispose() {
    const gl = this.gl
    for (const tex of this.textures.values()) gl.deleteTexture(tex)
    this.textures.clear()
    gl.deleteBuffer(this.vbo)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.program)
  }
}
