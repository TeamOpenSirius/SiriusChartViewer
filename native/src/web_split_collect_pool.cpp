// Emscripten currently builds this viewer without pthreads. Keep the
// wds-editor split-collect ABI available while executing every job inline;
// spawning std::thread workers in a browser WASM module throws on the first
// rendered frame.

#include "split_collect_pool.hpp"

#include <algorithm>

namespace wds::chart_render {

SplitCollectCaps split_collect_caps_from_phys(int, int) noexcept { return {1, 1}; }

void split_collect_count_phys_linux(const SplitCollectLinuxCpu* rows, std::size_t n, int* p_phys,
                                    int* e_phys) noexcept {
  if (p_phys != nullptr) {
    *p_phys = rows != nullptr && n > 0 ? 1 : 0;
  }
  if (e_phys != nullptr) {
    *e_phys = 0;
  }
}

int split_collect_thread_count() noexcept { return 1; }
int split_collect_pool_cap() noexcept { return 1; }
int split_collect_p_cores() noexcept { return 1; }
int split_collect_e_cores() noexcept { return 0; }
int split_collect_burst_cap() noexcept { return 1; }
void split_collect_set_burst(bool) noexcept {}
bool split_collect_burst_allowed() noexcept { return false; }
int split_collect_last_participants() noexcept { return 1; }
int split_collect_last_call_participants() noexcept { return 1; }
int split_collect_frame_max_participants() noexcept { return 1; }
std::uint64_t split_collect_frame_wakeups() noexcept { return 0; }
int split_collect_claim_depth() noexcept { return 0; }
void split_collect_begin_frame() noexcept {}
void split_collect_prepare_heavy(int) noexcept {}
void split_collect_note_work(std::size_t, std::uint64_t) noexcept {}

void split_collect_parallel_for(std::size_t begin, std::size_t end, std::size_t,
                                void (*fn)(std::size_t, void*), void* ctx,
                                std::uint64_t) {
  if (fn == nullptr) {
    return;
  }
  for (std::size_t i = begin; i < end; ++i) {
    fn(i, ctx);
  }
}

void split_collect_parallel_for(std::size_t begin, std::size_t end, std::size_t grain,
                                void (*fn)(std::size_t, void*), void* ctx) {
  split_collect_parallel_for(begin, end, grain, fn, ctx, end >= begin ? end - begin : 0);
}

void split_collect_parallel_for(std::size_t n, void (*fn)(std::size_t, void*), void* ctx) {
  split_collect_parallel_for(0, n, 1, fn, ctx, n);
}

}  // namespace wds::chart_render
