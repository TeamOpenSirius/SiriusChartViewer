#pragma once

// Web stand-in for wds-editor's BASS AudioEngine.
//
// Upstream HitSfxPlayer (audio-player/src/hit_sfx.cpp) is compiled unchanged and
// forwards to this class. Instead of mixing audio, every request is recorded as
// a command that the Web Audio side drains after each frame; the music clock and
// position generation are pushed in from JavaScript before the frame runs.

#include <wds/audio/hit_sfx.hpp>
#include <wds/common/time.hpp>

#include <cstdint>
#include <vector>

namespace wds::audio {

enum class WebSfxCommandKind : int32_t {
  Play = 0,         // play `clip` now
  ScheduleAt = 1,   // play `clip` at music time `music_us`
  StopAll = 2,      // cancel scheduled + audible one-shots and the hold loop
  HoldLoop = 3,     // clip field: 1 = start looping, 0 = stop
  HoldGate = 4,     // clip field: 1 = on / 0 = off at `music_us`
  ClearHoldGates = 5,
};

struct WebSfxCommand {
  int32_t kind = 0;
  int32_t clip = 0;
  double music_us = 0.0;
};

class AudioEngine {
 public:
  // ---- driven by JS each frame ----
  void set_ready(bool ready) noexcept { ready_ = ready; }
  void set_clock(int64_t music_us, uint64_t generation) noexcept {
    music_us_ = music_us;
    position_generation_ = generation;
  }
  std::vector<WebSfxCommand>& commands() noexcept { return commands_; }

  // ---- HitSfxPlayer facade ----
  // The browser always has an AudioContext clock (with or without BGM), so the
  // preview uses the music-clock scheduling path unconditionally.
  bool has_music() const noexcept { return ready_; }
  bool sfx_ready() const noexcept { return ready_; }
  wds::common::Microseconds position() const noexcept {
    return wds::common::Microseconds{music_us_};
  }
  uint64_t position_generation() const noexcept { return position_generation_; }

  bool play_sfx(HitSfxClip clip) {
    push(WebSfxCommandKind::Play, static_cast<int32_t>(clip), 0);
    return true;
  }
  bool schedule_sfx_at(HitSfxClip clip, wds::common::Microseconds at) {
    push(WebSfxCommandKind::ScheduleAt, static_cast<int32_t>(clip), at.count());
    return true;
  }
  size_t pending_sfx_sync_count() const noexcept { return 0; }
  void clear_hold_gates() { push(WebSfxCommandKind::ClearHoldGates, 0, 0); }
  bool schedule_hold_gate(bool enabled, wds::common::Microseconds at) {
    push(WebSfxCommandKind::HoldGate, enabled ? 1 : 0, at.count());
    return true;
  }
  void set_hold_looping(bool enabled) {
    if (enabled == hold_looping_) {
      return;
    }
    hold_looping_ = enabled;
    push(WebSfxCommandKind::HoldLoop, enabled ? 1 : 0, 0);
  }
  bool hold_looping() const noexcept { return hold_looping_; }
  void stop_all_sfx() {
    hold_looping_ = false;
    push(WebSfxCommandKind::StopAll, 0, 0);
  }

 private:
  void push(WebSfxCommandKind kind, int32_t clip, int64_t music_us) {
    commands_.push_back(
        WebSfxCommand{static_cast<int32_t>(kind), clip, static_cast<double>(music_us)});
  }

  bool ready_ = false;
  bool hold_looping_ = false;
  int64_t music_us_ = 0;
  uint64_t position_generation_ = 0;
  std::vector<WebSfxCommand> commands_;
};

}  // namespace wds::audio
