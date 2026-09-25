// Port of split_boundaries_12 / split_color_for_id / split_slot_color from wds-editor
// ui/src/regions/edit/edit_gutters.cpp. Keep in sync with upstream.

#include <wds/ui/regions/edit/edit_gutters.hpp>

#include <wds/chart_render/split_line_official_colors.hpp>
#include <wds/core/gimmick.hpp>
#include <wds/core/split_fade.hpp>

#include <cmath>

namespace wds::ui {

using wds::interaction::Color;

void split_boundaries_12(int32_t split_count, std::vector<int32_t>& out) {
  out.clear();
  switch (split_count) {
    case 2:
      out = {5};
      break;
    case 3:
      out = {3, 7};
      break;
    case 4:
      out = {2, 5, 8};
      break;
    case 5:
      out = {2, 4, 6, 8};
      break;
    case 6:
      out = {1, 3, 5, 7, 9};
      break;
    default:
      break;
  }
}

Color split_color_for_id(int32_t color_id) noexcept {
  const uint32_t h = static_cast<uint32_t>(color_id) * 2654435761u;
  const float hue = (h % 360) / 360.0f;
  const float s = 0.72f;
  const float v = 0.88f;
  const float c = v * s;
  const float x = c * (1.0f - std::fabs(std::fmod(hue * 6.0f, 2.0f) - 1.0f));
  const float m = v - c;
  float r = 0, g = 0, b = 0;
  const int sector = static_cast<int>(hue * 6.0f) % 6;
  switch (sector) {
    case 0:
      r = c;
      g = x;
      break;
    case 1:
      r = x;
      g = c;
      break;
    case 2:
      g = c;
      b = x;
      break;
    case 3:
      g = x;
      b = c;
      break;
    case 4:
      r = x;
      b = c;
      break;
    default:
      r = c;
      b = x;
      break;
  }
  return {r + m, g + m, b + m, 1.0f};
}

Color split_slot_color(int32_t color_id, int32_t world_index, int32_t split_count,
                       const wds::renderer::SkinCatalog* /*skin*/) noexcept {
  const int32_t official =
      wds::chart_editor::split_color_slot(color_id, split_count, world_index);
  float sr = 1.0f, sg = 1.0f, sb = 1.0f, sa = 1.0f;
  if (wds::chart_render::official_split_line_color(color_id, official, sr, sg, sb, sa)) {
    return {sr, sg, sb, sa};
  }
  return split_color_for_id(color_id);
}

}  // namespace wds::ui
