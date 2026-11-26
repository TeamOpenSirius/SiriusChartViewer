# Sirius Chart Viewer

<p align="center">
  <img src="./public/logo.png" alt="Sirius Chart Viewer" width="112" />
</p>

<p align="center">
  A browser-based 3D chart previewer for <em>World Dai Star</em>, powered by the
  <a href="https://github.com/TeamOpenSirius/wds-editor">wds-editor</a> preview core.
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> ·
  <a href="./README-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/TeamOpenSirius/SiriusChartViewer/actions/workflows/build.yml"><img src="https://github.com/TeamOpenSirius/SiriusChartViewer/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--only-blue.svg" alt="License: GPL-3.0-only" /></a>
  <img src="https://img.shields.io/badge/Vue-3.4%2B-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/WebAssembly-Emscripten-654ff0?logo=webassembly&logoColor=white" alt="WebAssembly" />
  <img src="https://img.shields.io/badge/Renderer-WebGL2-990000" alt="WebGL2" />
</p>

---

## Overview

**Sirius Chart Viewer** brings the desktop chart preview experience of [`wds-editor`](https://github.com/TeamOpenSirius/wds-editor) directly to the browser.

Instead of reimplementing chart parsing and rendering in JavaScript, the project compiles the upstream C++ preview core to **WebAssembly** via Emscripten and drives rendering through **WebGL2**. Playback timing and hit-sound scheduling are powered by the **Web Audio API**, while the standalone web app and embeddable component are built with **Vue 3 + TypeScript**.

> This project is a **chart viewer only** and does not include chart editing features.

## Features

- **Native-fidelity 3D preview** directly in the browser via `wds-editor` (Git submodule).
- **Multiple chart formats**: `.wdschart` (including Refresh / SV geometry), official `.csv`, and `.sus`.
- **Optional media inputs**: BGM audio, song jacket / cover art (rendered on the stage screens), and official `music_config.csv`.
- **Accurate visual & audio playback**: stage, notes, split lines & effects, combo counter, optional judgment text, and scheduled hit SFX.
- **Complete playback controls**: play/pause, scrubbing, `0.5×` – `2.0×` playback rate, fullscreen (with mobile landscape rotation where supported), and keyboard shortcuts.
- **Customizable display & audio**: note speed, lane cover / start offset, note thickness, split-line effect opacity, judgment text toggle, music/SFX volume, and hold-body SFX mute.
- **Staged resource loading**: blocks playback until engine, textures, SFX, chart, audio, and cover are ready, with progress feedback and retry on failure.
- **Dual distribution**: deploy as a **standalone static web app** or embed as a **Vue 3 component** (`@team-opensirius/sirius-chart-viewer`).

## Supported Inputs

| Input | Supported Formats / Behavior |
| --- | --- |
| **Chart** | `.wdschart`, official `.csv`, `.sus` |
| **Music** *(optional)* | `.ogg`, `.mp3`, `.wav`, `.m4a`, `.aac`, `.flac`, `.opus`, `.webm` (omitting plays on a silent clock) |
| **Cover** *(optional)* | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`, `.bmp` |
| **Config** *(optional)* | `music_config.csv` (`DelaySeconds`) |

### URL Query Parameters (Standalone App)

You can pre-load remote resources via query string:

```text
/?chart=<chart_url>&music=<audio_url>&config=<music_config_url>&cover=<image_url>&name=<filename>&t=<seconds>
```

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / Pause |
| `←` / `→` | Seek backward / forward 5 seconds |
| `Shift` + `←` / `→` | Seek backward / forward 1 second |
| `Home` | Jump to start |
| `F` or double-click stage | Toggle fullscreen |
| `Esc` | Close settings panel / About modal |

## Using as a Vue 3 Component

Install the package (requires `vue >= 3.4`):

```bash
npm install @team-opensirius/sirius-chart-viewer
```

Serve the package's `dist-lib/assets/` directory (containing `wasm/` and `effects/`) as static files and pass its URL to `asset-base`:

```vue
<script setup lang="ts">
import { SiriusChartViewer } from '@team-opensirius/sirius-chart-viewer'
import '@team-opensirius/sirius-chart-viewer/style.css'
</script>

<template>
  <div style="width: 100%; height: 600px">
    <SiriusChartViewer
      chart="/charts/demo.csv"
      music="/charts/demo.ogg"
      cover="/charts/jacket.png"
      asset-base="/sirius-chart-viewer/"
    />
  </div>
</template>
```

### Component Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `chart` | `ChartSource \| null` | `null` | Chart file (`File`, `Blob`, `ArrayBuffer`, `ArrayBufferView`, or URL string) |
| `chartName` | `string` | `''` | File name hint used to detect format when `chart` has no name |
| `music` | `ChartSource \| null` | `null` | Optional BGM audio |
| `musicConfig` | `ChartSource \| null` | `null` | Optional official `music_config.csv` |
| `cover` | `ChartSource \| null` | `null` | Optional song jacket image |
| `assetBase` | `string` | `'/sirius-chart-viewer/'` | Base URL containing `wasm/` and `effects/` |
| `autoplay` | `boolean` | `false` | Auto-start playback once all resources are loaded |
| `pending` | `boolean` | `false` | Set `true` while host is still fetching Blob/binary sources |
| `fetchInit` | `RequestInit` | `undefined` | Custom `fetch()` options for URL sources |

### Events & Exposed Methods

- **Events**: `ready`, `loaded(info: ChartInfo)`, `error(message: string)`, `ended`
- **Exposed (`ref`)**: `play()`, `pause()`, `toggle()`, `seek(seconds: number)`, `viewer`

See [docs/loading.md](./docs/loading.md) for resource loading guarantees and host integration details.

## Local Development & Building

### Prerequisites

- **Node.js** 22+
- **Emscripten** (`emcc` / `emcmake` on `PATH`, or `EMSDK` set, or `/usr/lib/emscripten` on Linux)
- **CMake** 3.20+ and **Ninja** (recommended)

### Setup

```bash
git clone --recursive https://github.com/TeamOpenSirius/SiriusChartViewer.git
cd SiriusChartViewer
npm ci
```

If you already cloned without `--recursive`:

```bash
git submodule update --init --recursive
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Sync assets, build WASM core, and start Vite dev server |
| `npm run build` | Build standalone static web app into `dist/` |
| `npm run build:lib` | Build embeddable Vue library + types + runtime assets into `dist-lib/` |
| `npm run build:wasm` | Compile native C++ preview core to WebAssembly (`public/wasm/`) |
| `npm run typecheck` | Run `vue-tsc --noEmit` |
| `npm test` | Run loading, audio transport, and WASM preview regression tests |

## Project Structure

```text
SiriusChartViewer/
├── native/                 # C++ WebAssembly entrypoints and WebGL2/Web Audio shims
├── third_party/wds-editor/ # Upstream wds-editor preview core (Git submodule)
├── scripts/                # Asset sync, WASM build, and library packaging scripts
├── src/
│   ├── App.vue             # Standalone web application shell
│   ├── components/         # SiriusChartViewer, SettingsPanel, AboutModal
│   └── lib/                # WebGL2 renderer, WASM loader, Web Audio transport & SFX
├── tests/                  # Automated tests (loading, transport, WASM preview)
└── docs/                   # Design & integration notes
```

## License

This project is licensed under the **GNU General Public License v3.0 (`GPL-3.0-only`)**. See [LICENSE](./LICENSE) for full terms.
