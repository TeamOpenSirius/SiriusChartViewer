#pragma once

// Web stand-in for wds-editor's VulkanRenderer.
//
// Upstream PlaybackPreviewView / TextureCache talk to a `VulkanRenderer`; in the
// browser there is no Vulkan, so this class keeps the same surface but only
// records work for JavaScript:
//   - create_texture_rgba() queues RGBA uploads that the WebGL2 side drains.
//   - draw_frame() flattens every pass into one vertex array + a command list
//     with the exact pass order / blend mode of the Vulkan implementation.
// The build copies upstream `texture.hpp` next to this header so its quoted
// `#include "vulkan_renderer.hpp"` resolves here instead of the real one.

#include "draw_batch.hpp"
#include "draw_types.hpp"

#include <cstddef>
#include <cstdint>
#include <functional>
#include <vector>

#ifndef VK_NULL_HANDLE
#define VK_NULL_HANDLE nullptr
#endif
#ifndef VK_VERSION_MAJOR
#define VK_VERSION_MAJOR(version) ((uint32_t)(version) >> 22U)
#define VK_VERSION_MINOR(version) (((uint32_t)(version) >> 12U) & 0x3FFU)
#define VK_VERSION_PATCH(version) ((uint32_t)(version)&0xFFFU)
#endif

namespace wds::renderer {

using VkInstance = void*;

struct VulkanHostSurface {
  VkInstance external_instance = VK_NULL_HANDLE;
  std::function<void(int* width, int* height)> framebuffer_size;
  std::function<int()> display_refresh_hz;
};

// Blend mode per recorded draw command (matches the two Vulkan pipelines).
enum class WebBlend : uint32_t {
  Alpha = 0,     // SRC_ALPHA / ONE_MINUS_SRC_ALPHA
  Additive = 1,  // SRC_ALPHA / ONE
};

enum class RendererHealth : uint8_t {
  Uninitialized = 0,
  Ready,
  Occluded,
  SurfaceLost,
  DeviceLost,
  Fatal,
};

struct RendererPathSample {
  int64_t create_texture_rgba_us = 0;
  int64_t upload_fence_wait_us = 0;
  int64_t upload_submit_us = 0;
  int64_t upload_fence_reap_us = 0;
  int64_t descriptor_allocate_us = 0;
};

struct RendererPathSnapshot {
  RendererPathSample last{};
  RendererPathSample total{};
};

struct WebDrawCommand {
  uint32_t blend = 0;
  uint32_t texture = 0;
  uint32_t first_vertex = 0;
  uint32_t vertex_count = 0;
};

struct WebTextureUpload {
  uint32_t id = 0;
  int32_t width = 0;
  int32_t height = 0;
  int32_t nearest = 0;
  // Owned by the renderer until the JS side calls clear_texture_uploads().
  const unsigned char* pixels = nullptr;
};

class VulkanRenderer {
 public:
  struct ScissorRect {
    int x = 0;
    int y = 0;
    int w = 0;
    int h = 0;
    bool valid() const noexcept { return w > 0 && h > 0; }
  };

  struct DrawFrameExtras {
    const DrawBatch* const* early_extra = nullptr;
    size_t early_extra_n = 0;
    const DrawBatch* const* mid_prefix = nullptr;
    size_t mid_prefix_n = 0;
    const DrawBatch* const* carve_prefix = nullptr;
    size_t carve_prefix_n = 0;
    bool extras_in_mapped_vb = false;
    uint32_t mapped_extra_low = 0;
  };

  struct PersistentVbLock {
    DrawVertex* mapped = nullptr;
    size_t capacity_bytes = 0;
    uint32_t* idx_mapped = nullptr;
    size_t idx_capacity_bytes = 0;
    uint32_t frame = 0;
  };

  struct DrawFrameDump {
    DrawBatch* scene = nullptr;
    DrawBatch* glow = nullptr;
    DrawBatch* notes = nullptr;
    DrawBatch* late = nullptr;
    DrawBatch* additive = nullptr;
  };

  bool create(const VulkanHostSurface& host);
  void destroy();
  bool ready() const noexcept { return ready_; }
  RendererHealth health() const noexcept {
    return ready_ ? RendererHealth::Ready : RendererHealth::Uninitialized;
  }
  void device_wait_idle() noexcept {}

  void set_preferred_msaa(int samples) noexcept { msaa_ = samples; }
  void apply_msaa(int samples) noexcept { msaa_ = samples; }
  int active_msaa() const noexcept { return msaa_; }
  RendererPathSnapshot path_diagnostics() const noexcept { return {}; }
  int64_t last_gpu_submit_us() const noexcept { return 0; }
  size_t persistent_vertex_ring_bytes() const noexcept { return 0; }
  bool lock_persistent_vb(size_t, PersistentVbLock*, size_t = 0) { return false; }
  void set_syuriken_uniforms(float, TextureId) noexcept {}
  bool syuriken_ready() const noexcept { return false; }

  uint32_t device_api_version() const noexcept { return 0; }
  uint32_t device_driver_version() const noexcept { return 0; }
  const char* device_name() const noexcept { return "WebGL2"; }

  void resize(int width, int height) noexcept;
  int framebuffer_width() const noexcept { return width_; }
  int framebuffer_height() const noexcept { return height_; }

  TextureInfo create_texture_rgba(const unsigned char* pixels, int width, int height,
                                  bool nearest = false);
  void destroy_texture(TextureId id);
  // Web-only: replace the pixels of a live texture (same id, new size allowed).
  bool replace_texture_rgba(TextureId id, const unsigned char* pixels, int width, int height,
                            bool nearest = false);

  bool draw_frame(const DrawBatch& batch, const ScreenBounds& screen, float clear_r = 0.05f,
                  float clear_g = 0.05f, float clear_b = 0.08f,
                  const DrawBatch* additive = nullptr,
                  const DrawBatch* post_overlay = nullptr,
                  const DrawBatch* post_overlay2 = nullptr,
                  const ScissorRect* additive_scissor = nullptr,
                  const DrawBatch* mid_overlay = nullptr,
                  const DrawBatch* early_additive = nullptr,
                  const DrawBatch* scene_carve = nullptr,
                  const DrawBatch* playfield_hud = nullptr,
                  const DrawFrameExtras* extras = nullptr,
                  DrawFrameDump* dump = nullptr);

  // ---- JS bridge (read after draw_frame) ----
  const std::vector<DrawVertex>& frame_vertices() const noexcept { return vertices_; }
  const std::vector<WebDrawCommand>& frame_commands() const noexcept { return commands_; }
  const float* frame_mvp() const noexcept { return mvp_; }
  const float* frame_clear() const noexcept { return clear_; }
  // [valid, x, y, w, h] in framebuffer pixels, top-left origin. Applies to additive only.
  const int32_t* frame_additive_scissor() const noexcept { return additive_scissor_; }

  std::vector<WebTextureUpload>& texture_uploads() noexcept { return uploads_; }
  void clear_texture_uploads();
  std::vector<uint32_t>& texture_deletes() noexcept { return deletes_; }

 private:
  struct PendingPixels {
    uint32_t id = 0;
    std::vector<unsigned char> rgba;
  };

  void append_pass(const DrawBatch& src, WebBlend blend);

  bool ready_ = false;
  int msaa_ = 2;
  int width_ = 1;
  int height_ = 1;
  uint32_t next_texture_id_ = 1;
  std::vector<uint32_t> live_textures_;

  std::vector<DrawVertex> vertices_;
  std::vector<WebDrawCommand> commands_;
  float mvp_[16] = {};
  float clear_[3] = {0.05f, 0.05f, 0.08f};
  int32_t additive_scissor_[5] = {};

  std::vector<PendingPixels> pending_pixels_;
  std::vector<WebTextureUpload> uploads_;
  std::vector<uint32_t> deletes_;
};

}  // namespace wds::renderer
