// Browser replacement for wds-editor common/src/log.cpp. The desktop version
// writes crash-report rings and session files through crash_handler.cpp, none
// of which exists in the browser; here every WDS_LOG line goes to the console.

#include <wds/common/log.hpp>

#include <cstdarg>
#include <cstdio>

namespace wds::common {

void log_ring_append(const char* fmt, ...) {
#if defined(WDS_WEB_VERBOSE_LOG) && WDS_WEB_VERBOSE_LOG
  std::fputs("[wds] ", stderr);
  va_list args;
  va_start(args, fmt);
  std::vfprintf(stderr, fmt, args);
  va_end(args);
#else
  (void)fmt;
#endif
}

void log_ring_write_text(JournalEmitFn /*emit*/, void* /*ctx*/) {}

void log_open_debug_session() {}

const char* log_debug_session_path() { return ""; }

void log_emit(const char* fmt, ...) {
  va_list args;
  va_start(args, fmt);
  std::vfprintf(stderr, fmt, args);
  va_end(args);
}

}  // namespace wds::common
