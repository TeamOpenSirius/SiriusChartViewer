#pragma once

// Web subset of wds-editor ui/include/wds/ui/regions/edit/edit_gutters.hpp.
// PlaybackPreviewView only needs split boundaries and slot colors; the rest of the
// header drags in the editor's UiPainter / widget stack.

#include <wds/interaction/types.hpp>
#include <wds/renderer/skin_catalog.hpp>

#include <cstdint>
#include <vector>

namespace wds::ui {

// Official split-effect boundaries on the 12-lane grid.
void split_boundaries_12(int32_t split_count, std::vector<int32_t>& out);

wds::interaction::Color split_color_for_id(int32_t color_id) noexcept;

wds::interaction::Color split_slot_color(int32_t color_id, int32_t world_index,
                                         int32_t split_count,
                                         const wds::renderer::SkinCatalog* skin) noexcept;

}  // namespace wds::ui
