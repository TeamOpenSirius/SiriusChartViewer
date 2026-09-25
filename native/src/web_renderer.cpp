#include "wds/renderer/vulkan_renderer.hpp"

#include <algorithm>
#include <cstring>

namespace wds::renderer {
namespace {

// Same matrix as VulkanRenderer's ortho_rh(). Vulkan maps z to [0, 1]; under
// GL the resulting z_ndc = 0.5 - z/2 stays inside [-1, 1] for the z range the
// preview uses, and depth testing is off anyway (Vulkan never writes depth).
void ortho_rh(float l, float r, float b, float t, float n, float f, float* out16) {
  std::memset(out16, 0, sizeof(float) * 16);
  out16[0] = 2.0f / (r - l);
  out16[5] = 2.0f / (t - b);
  out16[10] = -1.0f / (f - n);
  out16[12] = -(r + l) / (r - l);
  out16[13] = -(t + b) / (t - b);
  out16[14] = f / (f - n);
  out16[15] = 1.0f;
}

}  // namespace

bool VulkanRenderer::create(const VulkanHostSurface& host) {
  if (host.framebuffer_size) {
    int w = 0;
    int h = 0;
    host.framebuffer_size(&w, &h);
    resize(w, h);
  }
  ready_ = true;
  return true;
}

void VulkanRenderer::destroy() {
  for (uint32_t id : live_textures_) {
    deletes_.push_back(id);
  }
  live_textures_.clear();
  pending_pixels_.clear();
  uploads_.clear();
  vertices_.clear();
  commands_.clear();
  ready_ = false;
}

void VulkanRenderer::resize(int width, int height) noexcept {
  width_ = std::max(1, width);
  height_ = std::max(1, height);
}

TextureInfo VulkanRenderer::create_texture_rgba(const unsigned char* pixels, int width, int height,
                                                bool nearest) {
  if (pixels == nullptr || width <= 0 || height <= 0) {
    return {};
  }
  const uint32_t id = next_texture_id_++;
  PendingPixels pending;
  pending.id = id;
  pending.rgba.assign(pixels, pixels + static_cast<size_t>(width) * height * 4);
  // std::vector move keeps the heap buffer, so the pointer stays valid while
  // pending_pixels_ grows.
  const unsigned char* data = pending.rgba.data();
  pending_pixels_.push_back(std::move(pending));
  uploads_.push_back(WebTextureUpload{id, width, height, nearest ? 1 : 0, data});
  live_textures_.push_back(id);

  TextureInfo info;
  info.id = id;
  info.width = width;
  info.height = height;
  return info;
}

bool VulkanRenderer::replace_texture_rgba(TextureId id, const unsigned char* pixels, int width,
                                          int height, bool nearest) {
  if (pixels == nullptr || width <= 0 || height <= 0 ||
      std::find(live_textures_.begin(), live_textures_.end(), id) == live_textures_.end()) {
    return false;
  }
  // Drop a not-yet-drained upload of the same id; JS replaces the GL texture on upload.
  pending_pixels_.erase(std::remove_if(pending_pixels_.begin(), pending_pixels_.end(),
                                       [id](const PendingPixels& p) { return p.id == id; }),
                        pending_pixels_.end());
  uploads_.erase(std::remove_if(uploads_.begin(), uploads_.end(),
                                [id](const WebTextureUpload& u) { return u.id == id; }),
                 uploads_.end());
  PendingPixels pending;
  pending.id = id;
  pending.rgba.assign(pixels, pixels + static_cast<size_t>(width) * height * 4);
  const unsigned char* data = pending.rgba.data();
  pending_pixels_.push_back(std::move(pending));
  uploads_.push_back(WebTextureUpload{id, width, height, nearest ? 1 : 0, data});
  return true;
}

void VulkanRenderer::destroy_texture(TextureId id) {
  const auto it = std::find(live_textures_.begin(), live_textures_.end(), id);
  if (it == live_textures_.end()) {
    return;
  }
  live_textures_.erase(it);
  pending_pixels_.erase(std::remove_if(pending_pixels_.begin(), pending_pixels_.end(),
                                       [id](const PendingPixels& p) { return p.id == id; }),
                        pending_pixels_.end());
  uploads_.erase(std::remove_if(uploads_.begin(), uploads_.end(),
                                [id](const WebTextureUpload& u) { return u.id == id; }),
                 uploads_.end());
  deletes_.push_back(id);
}

void VulkanRenderer::clear_texture_uploads() {
  uploads_.clear();
  pending_pixels_.clear();
  deletes_.clear();
}

void VulkanRenderer::append_pass(const DrawBatch& src, WebBlend blend) {
  for (const auto& bucket : src.buckets) {
    if (bucket.vertices.empty() || bucket.texture == kInvalidTextureId) {
      continue;
    }
    WebDrawCommand cmd;
    cmd.blend = static_cast<uint32_t>(blend);
    cmd.texture = bucket.texture;
    cmd.first_vertex = static_cast<uint32_t>(vertices_.size());
    cmd.vertex_count = static_cast<uint32_t>(bucket.vertices.size());
    vertices_.insert(vertices_.end(), bucket.vertices.begin(), bucket.vertices.end());
    commands_.push_back(cmd);
  }
}

bool VulkanRenderer::draw_frame(const DrawBatch& batch, const ScreenBounds& screen, float clear_r,
                                float clear_g, float clear_b, const DrawBatch* additive,
                                const DrawBatch* post_overlay, const DrawBatch* post_overlay2,
                                const ScissorRect* additive_scissor,
                                const DrawBatch* mid_overlay) {
  vertices_.clear();
  commands_.clear();
  clear_[0] = clear_r;
  clear_[1] = clear_g;
  clear_[2] = clear_b;
  ortho_rh(screen.l, screen.r, screen.b, screen.t, -1.0f, 1.0f, mvp_);

  // Pass order mirrors VulkanRenderer::draw_frame:
  // batch → mid_overlay → additive → post_overlay → post_overlay2.
  append_pass(batch, WebBlend::Alpha);
  if (mid_overlay != nullptr) {
    append_pass(*mid_overlay, WebBlend::Alpha);
  }
  if (additive != nullptr) {
    append_pass(*additive, WebBlend::Additive);
  }
  if (post_overlay != nullptr) {
    append_pass(*post_overlay, WebBlend::Alpha);
  }
  if (post_overlay2 != nullptr) {
    append_pass(*post_overlay2, WebBlend::Alpha);
  }

  if (additive_scissor != nullptr && additive_scissor->valid()) {
    additive_scissor_[0] = 1;
    additive_scissor_[1] = additive_scissor->x;
    additive_scissor_[2] = additive_scissor->y;
    additive_scissor_[3] = additive_scissor->w;
    additive_scissor_[4] = additive_scissor->h;
  } else {
    additive_scissor_[0] = 0;
  }
  return true;
}

}  // namespace wds::renderer
