# Sirius Chart Viewer

<p align="center">
  <img src="./public/logo.png" alt="Sirius Chart Viewer" width="112" />
</p>

<p align="center">
  基于 <a href="https://github.com/TeamOpenSirius/wds-editor">wds-editor</a> 预览内核的
  <em>World Dai Star</em> 网页 3D 谱面预览器。
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <a href="https://github.com/TeamOpenSirius/SiriusChartViewer/actions/workflows/build.yml"><img src="https://github.com/TeamOpenSirius/SiriusChartViewer/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--only-blue.svg" alt="License: GPL-3.0-only" /></a>
  <img src="https://img.shields.io/badge/Vue-3.4%2B-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/WebAssembly-Emscripten-654ff0?logo=webassembly&logoColor=white" alt="WebAssembly" />
  <img src="https://img.shields.io/badge/Renderer-WebGL2-990000" alt="WebGL2" />
</p>

---

## 项目简介

**Sirius Chart Viewer** 将桌面端 [`wds-editor`](https://github.com/TeamOpenSirius/wds-editor) 的 3D 谱面预览能力完整移植到了浏览器。

项目没有在 JavaScript 中重写整套渲染管线，而是通过 **Emscripten** 直接将上游 C++ 预览核心编译为 **WebAssembly**，并使用 **WebGL2** 复现渲染管线。播放时钟与打击音调度基于 **Web Audio API**，独立页面与可嵌入组件使用 **Vue 3 + TypeScript** 构建。

> 本项目仅提供**谱面预览功能**，不包含谱面编辑功能。

## 主要特性

- **原生级 3D 预览**：通过 Git submodule 直接复用 `wds-editor` C++ 预览核心。
- **多格式谱面支持**：支持 `.wdschart`（含 Refresh / SV 几何）、官方 `.csv` 以及 `.sus`。
- **可选媒体资源**：支持加载 BGM 音乐、曲绘封面（绘制于舞台大屏）及官方 `music_config.csv`。
- **画面与音效一致**：还原舞台、Note、分割线与特效、Combo 显示、可选判定文字以及精确调度的打击音效。
- **完整播放控制**：播放/暂停、进度条拖拽、`0.5×` ～ `2.0×` 倍速、全屏（支持移动端横屏锁定）及快捷键操作。
- **丰富的显示与声音设置**：流速、挡板（起始偏移）、Note 厚度、分割线特效透明度、判定文字开关、音乐/打击音量、静音长按持续音。
- **分阶段资源加载**：等待引擎、贴图、音效、谱面、音频与封面全部就绪后再解锁播放，提供阶段进度展示与失败重试。
- **双形态产物**：既可部署为**独立静态网页**，也可作为 **Vue 3 组件库**（`@team-opensirius/sirius-chart-viewer`）嵌入其他项目。

## 支持的输入

| 类型 | 支持格式 / 说明 |
| --- | --- |
| **谱面** | `.wdschart`、官方 `.csv`、`.sus` |
| **音乐**（可选） | `.ogg`、`.mp3`、`.wav`、`.m4a`、`.aac`、`.flac`、`.opus`、`.webm`（未提供时以静音时钟播放） |
| **封面**（可选） | `.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.avif`、`.bmp` |
| **配置**（可选） | `music_config.csv`（`DelaySeconds`） |

### URL 参数加载（独立网页）

支持通过 URL 查询参数直接加载远端资源：

```text
/?chart=<谱面URL>&music=<音频URL>&config=<music_configURL>&cover=<封面URL>&name=<文件名>&t=<起始秒数>
```

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Space` | 播放 / 暂停 |
| `←` / `→` | 快退 / 快进 5 秒 |
| `Shift` + `←` / `→` | 微调 1 秒 |
| `Home` | 回到开头 |
| `F` 或双击画面 | 切换全屏 |
| `Esc` | 关闭设置面板 / 关于窗口 |

## 作为 Vue 3 组件嵌入

安装依赖（需 `vue >= 3.4`）：

```bash
npm install @team-opensirius/sirius-chart-viewer
```

将包内 `dist-lib/assets/` 目录（包含 `wasm/` 与 `effects/`）作为静态资源部署，并将其路径传给 `asset-base`：

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

### 组件 Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `chart` | `ChartSource \| null` | `null` | 谱面文件（`File`、`Blob`、`ArrayBuffer`、`ArrayBufferView` 或 URL） |
| `chartName` | `string` | `''` | 当 `chart` 无文件名时用于识别格式的文件名 |
| `music` | `ChartSource \| null` | `null` | 可选 BGM 音频 |
| `musicConfig` | `ChartSource \| null` | `null` | 可选官方 `music_config.csv` |
| `cover` | `ChartSource \| null` | `null` | 可选曲绘封面 |
| `assetBase` | `string` | `'/sirius-chart-viewer/'` | 存放 `wasm/` 和 `effects/` 的静态资源基路径 |
| `autoplay` | `boolean` | `false` | 资源加载完成后自动播放 |
| `pending` | `boolean` | `false` | 宿主仍在拉取 Blob/二进制资源时设为 `true` |
| `fetchInit` | `RequestInit` | `undefined` | 拉取 URL 资源时的自定义 `fetch()` 选项 |

### 事件与暴露方法

- **事件**：`ready`、`loaded(info: ChartInfo)`、`error(message: string)`、`ended`
- **暴露方法（`ref`）**：`play()`、`pause()`、`toggle()`、`seek(seconds: number)`、`viewer`

更多资源加载约定详见 [docs/loading.md](./docs/loading.md)。

## 本地开发与构建

### 环境要求

- **Node.js** 22+
- **Emscripten**（`emcc` / `emcmake` 位于 `PATH`，或设置 `EMSDK`，或 Linux 系统安装路径 `/usr/lib/emscripten`）
- **CMake** 3.20+ 与 **Ninja**（推荐）

### 初始化

```bash
git clone --recursive https://github.com/TeamOpenSirius/SiriusChartViewer.git
cd SiriusChartViewer
npm ci
```

如果克隆时未加 `--recursive`：

```bash
git submodule update --init --recursive
```

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同步资源、编译 WASM 并启动 Vite 开发服务器 |
| `npm run build` | 构建独立静态网页至 `dist/` |
| `npm run build:lib` | 构建可嵌入 Vue 组件库、类型声明与运行时资源至 `dist-lib/` |
| `npm run build:wasm` | 单独编译 C++ 预览核心为 WebAssembly（输出至 `public/wasm/`） |
| `npm run typecheck` | 执行 `vue-tsc --noEmit` 类型检查 |
| `npm test` | 运行加载状态、音频时钟与原生 WASM 预览回归测试 |

## 目录结构

```text
SiriusChartViewer/
├── native/                 # C++ WebAssembly 入口及 WebGL2 / Web Audio 适配层
├── third_party/wds-editor/ # 上游 wds-editor 预览核心（Git submodule）
├── scripts/                # 资源同步、WASM 编译与组件库打包脚本
├── src/
│   ├── App.vue             # 独立网页应用壳
│   ├── components/         # SiriusChartViewer、SettingsPanel、AboutModal
│   └── lib/                # WebGL2 渲染器、WASM 加载器、Web Audio 时钟与音效
├── tests/                  # 自动化测试（加载、音频时钟、WASM 预览）
└── docs/                   # 设计与集成说明文档
```

## 开源许可证

本项目依据 **GNU General Public License v3.0（`GPL-3.0-only`）** 开源发布，详情请参阅 [LICENSE](./LICENSE)。
