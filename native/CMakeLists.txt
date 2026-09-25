cmake_minimum_required(VERSION 3.20)
project(sirius_chart_viewer_wasm CXX C)

if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "Configure with emcmake (Emscripten toolchain).")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(WDS_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../third_party/wds-editor" CACHE PATH "wds-editor checkout")
get_filename_component(WDS_ROOT "${WDS_ROOT}" ABSOLUTE)
if(NOT EXISTS "${WDS_ROOT}/core/CMakeLists.txt")
  message(FATAL_ERROR "wds-editor not found at ${WDS_ROOT} (git submodule update --init)")
endif()

set(VIEWER_OUT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../public/wasm" CACHE PATH "Output directory")

# --- Shim include dir -------------------------------------------------------
# Upstream texture.hpp does `#include "vulkan_renderer.hpp"` (quoted), which
# resolves next to the including file first. Copy it beside the web
# vulkan_renderer.hpp so the shim wins without patching wds-editor. Its quoted
# siblings (draw_batch / draw_types) are copied too; SHIM_GEN is the first
# include dir, so <wds/renderer/...> also resolves to these same copies.
set(SHIM_GEN "${CMAKE_CURRENT_BINARY_DIR}/shim")
file(MAKE_DIRECTORY "${SHIM_GEN}/wds/renderer")
foreach(_hdr texture.hpp draw_batch.hpp draw_types.hpp)
  configure_file("${WDS_ROOT}/renderer/include/wds/renderer/${_hdr}"
                 "${SHIM_GEN}/wds/renderer/${_hdr}" COPYONLY)
endforeach()
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/shim/wds/renderer/vulkan_renderer.hpp"
               "${SHIM_GEN}/wds/renderer/vulkan_renderer.hpp" COPYONLY)

set(WDS_CORE_SOURCES
  notation.cpp easing.cpp scratch_hold_curve.cpp chart_validation.cpp timing_map.cpp
  edit_grid.cpp edit_history.cpp note_edit_ops.cpp chart_session.cpp start_ms_avl_index.cpp
  chart_index.cpp gimmick.cpp split_lane_simulator.cpp chart_serializer.cpp file_io.cpp
  project.cpp official_chart.cpp sus_chart.cpp note_position_calculator.cpp
  auto_judge_simulator.cpp preview_snapshot.cpp preview_snapshot_builder.cpp
  chart_editor_engine.cpp)
list(TRANSFORM WDS_CORE_SOURCES PREPEND "${WDS_ROOT}/core/src/")

set(WDS_CHART_RENDER_SOURCES
  stage_geometry.cpp skin_catalog.cpp split_line_skins.cpp split_line_official_colors.cpp
  note_strips.cpp note_visual_policy.cpp)
list(TRANSFORM WDS_CHART_RENDER_SOURCES PREPEND "${WDS_ROOT}/chart-render/src/")

add_executable(sirius_viewer
  ${WDS_CORE_SOURCES}
  ${WDS_CHART_RENDER_SOURCES}
  "${WDS_ROOT}/common/src/utf8_path.cpp"
  "${WDS_ROOT}/renderer/src/texture.cpp"
  "${WDS_ROOT}/audio-player/src/hit_sfx.cpp"
  "${WDS_ROOT}/ui/src/regions/preview/playback_preview.cpp"
  src/web_log.cpp
  src/web_renderer.cpp
  src/split_colors.cpp
  src/viewer.cpp
)

# Order matters: shims shadow upstream headers of the same name.
target_include_directories(sirius_viewer PRIVATE
  "${SHIM_GEN}"
  "${CMAKE_CURRENT_SOURCE_DIR}/shim"
  "${WDS_ROOT}/common/include"
  "${WDS_ROOT}/core/include"
  "${WDS_ROOT}/renderer/include"
  "${WDS_ROOT}/renderer/third_party"
  "${WDS_ROOT}/chart-render/include"
  "${WDS_ROOT}/audio-player/include"
  "${WDS_ROOT}/interaction-interface/include"
  "${WDS_ROOT}/ui/include"
)

target_compile_definitions(sirius_viewer PRIVATE WDS_ENABLE_LOGGING=0)
if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  target_compile_definitions(sirius_viewer PRIVATE WDS_WEB_VERBOSE_LOG=1)
endif()

set(VIEWER_COMMON_FLAGS -sUSE_LIBPNG=1 -sUSE_ZLIB=1 -fwasm-exceptions)
target_compile_options(sirius_viewer PRIVATE ${VIEWER_COMMON_FLAGS} -Wall -Wno-unused-function)

target_link_options(sirius_viewer PRIVATE
  ${VIEWER_COMMON_FLAGS}
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sEXPORT_NAME=createSiriusViewer
  -sENVIRONMENT=web
  -sALLOW_MEMORY_GROWTH=1
  -sINITIAL_MEMORY=67108864
  -sSTACK_SIZE=1048576
  -sFILESYSTEM=1
  -sFORCE_FILESYSTEM=1
  "-sEXPORTED_FUNCTIONS=_malloc,_free"
  "-sEXPORTED_RUNTIME_METHODS=FS,HEAPU8,HEAP32,HEAPU32,HEAPF32,HEAPF64,UTF8ToString,stringToUTF8,lengthBytesUTF8,ccall,cwrap"
  "--preload-file" "${WDS_ROOT}/skins@/skins"
)

set_target_properties(sirius_viewer PROPERTIES
  OUTPUT_NAME "sirius-viewer"
  SUFFIX ".js"
  RUNTIME_OUTPUT_DIRECTORY "${VIEWER_OUT_DIR}"
)
