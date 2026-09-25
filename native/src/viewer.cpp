// SiriusChartViewer wasm entry points.
//
// Mirrors wds-editor's ChartPreviewPanel (ui/src/regions/preview/chart_preview_panel.cpp)
// minus Transport/BASS: the music clock comes from Web Audio, rendering is
// recorded by the web VulkanRenderer shim, and PlaybackPreviewView is compiled
// from upstream unchanged.

#include <wds/ui/regions/preview/playback_preview.hpp>

#include <wds/audio/audio_engine.hpp>
#include <wds/core/chart_editor_engine.hpp>
#include <wds/core/official_playfield.hpp>

#include <emscripten/emscripten.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>

namespace {

using wds::chart_editor::ChartEditorEngine;
using wds::chart_editor::SerializeError;
using wds::renderer::PreviewVisualConfig;

struct Viewer {
  wds::ui::PlaybackPreviewView preview;
  wds::audio::AudioEngine audio;
  ChartEditorEngine engine;
  wds::renderer::TextureInfo solid;
  std::string last_error;
  bool ready = false;
};

Viewer* g_viewer = nullptr;

void sync_core_config(Viewer& v) {
  const auto& visual = v.preview.config();
  wds::chart_editor::PreviewConfig core_cfg = v.engine.preview_config();
  core_cfg.lane_count = visual.lane_count;
  core_cfg.note_speed = visual.note_speed;
  core_cfg.note_approach_seconds = visual.appear_time();
  core_cfg.split_line_animation_start_sec = visual.split_line_animation_start;
  core_cfg.split_line_animation_end_sec = visual.split_line_animation_end;
  core_cfg.auto_hit_feedback_ms =
      std::llround(static_cast<double>(visual.effect_duration) * 1000.0);
  v.engine.set_preview_config(core_cfg);
}

// UiManager::resize_preview_viewport: centered 16:9 contain for bg + stage.
void layout(Viewer& v, int fb_w, int fb_h) {
  fb_w = std::max(1, fb_w);
  fb_h = std::max(1, fb_h);
  v.preview.resize(fb_w, fb_h);
  const double aspect = wds::chart_editor::kOfficialPreviewAspect;
  int w = fb_w;
  int h = static_cast<int>(std::lround(static_cast<double>(fb_w) / aspect));
  if (h > fb_h) {
    h = fb_h;
    w = static_cast<int>(std::lround(static_cast<double>(fb_h) * aspect));
  }
  w = std::max(1, w);
  h = std::max(1, h);
  const int x = (fb_w - w) / 2;
  const int y = (fb_h - h) / 2;
  v.preview.geometry().set_panel_rect(x, y, w, h);
  v.preview.geometry().set_content_rect(x, y, w, h);
}

}  // namespace

extern "C" {

// Skins are preloaded into MEMFS at /skins. Returns 1 on success.
EMSCRIPTEN_KEEPALIVE int wv_init(int fb_w, int fb_h) {
  if (g_viewer != nullptr) {
    return g_viewer->ready ? 1 : 0;
  }
  g_viewer = new Viewer();
  auto& v = *g_viewer;
  PreviewVisualConfig visual;
  visual.skins_directory = "/skins";
  visual.effects_directory = "";

  wds::renderer::VulkanHostSurface host;
  host.framebuffer_size = [fb_w, fb_h](int* w, int* h) {
    *w = fb_w;
    *h = fb_h;
  };
  if (!v.preview.initialize(host, visual)) {
    v.last_error = "preview initialize failed (skins)";
    return 0;
  }
  v.preview.attach_audio(&v.audio);
  sync_core_config(v);
  const unsigned char white[4] = {255, 255, 255, 255};
  v.solid = v.preview.vulkan().create_texture_rgba(white, 1, 1);
  layout(v, fb_w, fb_h);
  v.ready = true;
  return 1;
}

EMSCRIPTEN_KEEPALIVE const char* wv_last_error() {
  return g_viewer != nullptr ? g_viewer->last_error.c_str() : "not initialized";
}

// Load a chart already written to MEMFS. Format is detected by extension
// (.wdschart / official .csv / .sus). music_config_path may be empty.
EMSCRIPTEN_KEEPALIVE int wv_load_chart(const char* chart_path, const char* music_config_path) {
  if (g_viewer == nullptr) {
    return 0;
  }
  auto& v = *g_viewer;
  const auto result = v.engine.load_auto_from_file(
      chart_path != nullptr ? chart_path : "",
      music_config_path != nullptr ? music_config_path : "");
  if (result.error != SerializeError::Ok) {
    v.last_error = result.message.empty() ? "chart load failed" : result.message;
    return 0;
  }
  v.last_error.clear();
  v.engine.seek(0);
  return 1;
}

// Chart delay: tick 0 maps to this music time (ms). Negative → silent preroll.
EMSCRIPTEN_KEEPALIVE double wv_chart_offset_ms() {
  if (g_viewer == nullptr) {
    return 0;
  }
  return static_cast<double>(g_viewer->engine.document().timing().offset_ms);
}

// Music time (ms) of the last note end, for timelines without BGM.
EMSCRIPTEN_KEEPALIVE double wv_chart_end_ms() {
  if (g_viewer == nullptr) {
    return 0;
  }
  const auto& doc = g_viewer->engine.document();
  int64_t end = 0;
  for (const auto& note : doc.notes()) {
    end = std::max(end, std::max(note.start_ms(doc.timing()), note.end_ms(doc.timing())));
  }
  return static_cast<double>(end);
}

EMSCRIPTEN_KEEPALIVE int wv_note_count() {
  return g_viewer != nullptr ? static_cast<int>(g_viewer->engine.document().notes().size()) : 0;
}

EMSCRIPTEN_KEEPALIVE int wv_combo() {
  return g_viewer != nullptr ? g_viewer->engine.snapshot().combo_count : 0;
}

EMSCRIPTEN_KEEPALIVE void wv_resize(int fb_w, int fb_h) {
  if (g_viewer == nullptr || !g_viewer->ready) {
    return;
  }
  layout(*g_viewer, fb_w, fb_h);
}

// ChartPreviewPanel::apply_display_settings.
EMSCRIPTEN_KEEPALIVE void wv_set_display(double note_speed, int note_start_offset,
                                         int note_height_level, int split_line_opacity_percent) {
  if (g_viewer == nullptr) {
    return;
  }
  auto& v = *g_viewer;
  note_speed = wds::chart_editor::official_clamp_note_speed(note_speed);
  note_start_offset = wds::chart_editor::official_clamp_note_start_offset(note_start_offset);
  note_height_level = wds::chart_editor::official_clamp_note_height_level(note_height_level);
  split_line_opacity_percent =
      wds::chart_editor::official_clamp_split_effect_line_opacity(split_line_opacity_percent);

  auto visual = v.preview.config();
  visual.note_speed = static_cast<float>(note_speed);
  visual.note_start_offset = note_start_offset;
  visual.note_height_level = note_height_level;
  visual.split_line_opacity = static_cast<float>(split_line_opacity_percent) / 100.0f;
  v.preview.set_config(visual);
  sync_core_config(v);
}

EMSCRIPTEN_KEEPALIVE void wv_set_options(int mute_hold_body_sfx, int show_judgment_text) {
  if (g_viewer == nullptr) {
    return;
  }
  g_viewer->preview.set_mute_hold_body_sfx(mute_hold_body_sfx != 0);
  g_viewer->preview.set_show_judgment_text(show_judgment_text != 0);
}

// One display frame. music_us: audible music clock; generation bumps on every
// seek / play / pause (AudioEngine::position_generation semantics).
EMSCRIPTEN_KEEPALIVE void wv_frame(double music_us, int playing, double generation,
                                   int audio_ready, double visual_lead_us) {
  if (g_viewer == nullptr || !g_viewer->ready) {
    return;
  }
  auto& v = *g_viewer;
  const auto t = static_cast<int64_t>(std::llround(music_us));
  v.audio.set_ready(audio_ready != 0);
  v.audio.set_clock(t, static_cast<uint64_t>(generation));

  wds::common::TimelineSnapshot snap;
  snap.position = wds::common::Microseconds{t};
  snap.state = playing != 0 ? wds::common::PlaybackState::Playing
                            : wds::common::PlaybackState::Paused;
  v.engine.apply_timeline(snap);
  v.preview.set_chart_offset_ms(v.engine.document().timing().offset_ms);
  v.preview.set_preview_lead_in_visible_ms(v.engine.preview_lead_in_visible_ms());
  v.preview.sync_hit_sfx(v.engine.snapshot());
  v.preview.render(v.engine.snapshot(), nullptr, v.solid.id, nullptr, nullptr,
                   static_cast<int64_t>(std::llround(visual_lead_us)));
}

// ---- frame data (valid until the next wv_frame) ----
EMSCRIPTEN_KEEPALIVE const void* wv_vertices() {
  return g_viewer->preview.vulkan().frame_vertices().data();
}
EMSCRIPTEN_KEEPALIVE int wv_vertex_count() {
  return static_cast<int>(g_viewer->preview.vulkan().frame_vertices().size());
}
EMSCRIPTEN_KEEPALIVE const void* wv_commands() {
  return g_viewer->preview.vulkan().frame_commands().data();
}
EMSCRIPTEN_KEEPALIVE int wv_command_count() {
  return static_cast<int>(g_viewer->preview.vulkan().frame_commands().size());
}
EMSCRIPTEN_KEEPALIVE const float* wv_mvp() { return g_viewer->preview.vulkan().frame_mvp(); }
EMSCRIPTEN_KEEPALIVE const float* wv_clear_color() {
  return g_viewer->preview.vulkan().frame_clear();
}
EMSCRIPTEN_KEEPALIVE const int32_t* wv_additive_scissor() {
  return g_viewer->preview.vulkan().frame_additive_scissor();
}

// ---- texture upload / delete queues ----
EMSCRIPTEN_KEEPALIVE const void* wv_texture_uploads() {
  return g_viewer->preview.vulkan().texture_uploads().data();
}
EMSCRIPTEN_KEEPALIVE int wv_texture_upload_count() {
  return static_cast<int>(g_viewer->preview.vulkan().texture_uploads().size());
}
EMSCRIPTEN_KEEPALIVE const void* wv_texture_deletes() {
  return g_viewer->preview.vulkan().texture_deletes().data();
}
EMSCRIPTEN_KEEPALIVE int wv_texture_delete_count() {
  return static_cast<int>(g_viewer->preview.vulkan().texture_deletes().size());
}
EMSCRIPTEN_KEEPALIVE void wv_clear_texture_queues() {
  g_viewer->preview.vulkan().clear_texture_uploads();
}

// ---- SFX command queue ----
EMSCRIPTEN_KEEPALIVE const void* wv_sfx_commands() { return g_viewer->audio.commands().data(); }
EMSCRIPTEN_KEEPALIVE int wv_sfx_command_count() {
  return static_cast<int>(g_viewer->audio.commands().size());
}
EMSCRIPTEN_KEEPALIVE void wv_clear_sfx_commands() { g_viewer->audio.commands().clear(); }

}  // extern "C"
