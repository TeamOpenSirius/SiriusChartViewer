#pragma once

// Web subset of wds-editor ui/include/wds/ui/editor_ui_config.hpp — only what
// PlaybackPreviewView uses (the full header pulls in editor shortcuts / curves).

namespace wds::ui {

// Matches VulkanRenderer::set_preferred_msaa: ≤1 → 1, ≤2 → 2, else 4.
inline int clamp_msaa_samples(int samples) noexcept {
  return samples <= 1 ? 1 : (samples <= 2 ? 2 : 4);
}

}  // namespace wds::ui
