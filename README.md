# Sirius Chart Viewer

网页版 _World Dai Star_ 谱面 3D 预览器（WebAssembly + WebGL2 + Vue 3）。

预览内核直接复用 [wds-editor](https://github.com/TeamOpenSirius/wds-editor) 的 C++ 源码（git submodule），
画面、判定特效、分割线、Combo、打击音时序与桌面编辑器的预览区一致。

## 快速开始

环境要求：Node.js 20+、[Emscripten](https://emscripten.org/)、CMake 3.20+（推荐 Ninja）。

```bash
git clone --recursive <this repo>
# 已 clone 时：git submodule update --init

npm install
npm run dev        # 同步音效 → 编译 wasm → 启动 Vite
npm run build      # 独立页面，产物在 dist/，可部署到任意子路径（base: './'）
npm run build:lib  # 可嵌入组件，产物在 dist-lib/
```

Emscripten 查找顺序：`EMSDK` 环境变量 → `PATH` 上的 `emcc` → `C:/SDK/emsc/emsdk`。
`node scripts/build-wasm.mjs --debug` 生成带 `WDS_LOG` 输出的 Debug 版（`build/wasm-debug/`）。

## 使用

- 拖入或「打开文件」：谱面（`.wdschart` / 官方 `.csv` / `.sus`）、音乐（ogg/mp3/wav/m4a/flac）、曲绘图片、可选 `music_config.csv`（DelaySeconds），可一次多选。
- 快捷键：空格 播放/暂停，←/→ ±5s（Shift ±1s），Home 回到开头，F 或双击画面 全屏。
- 设置面板：流速 / 挡板 / Note 厚度 / 分割线特效透明度（与游戏内设置同范围）、音量、长按持续音静音、判定文字。

## 作为组件嵌入

`npm run build:lib` 生成：

```text
dist-lib/
├── sirius-chart-viewer.js / .css   # ES 模块（vue 为 peer dependency）+ 样式
├── types/                          # TypeScript 声明
└── assets/                         # 运行时文件，宿主需原样静态托管
    ├── wasm/                       #   sirius-viewer.js / .wasm / .data
    └── effects/                    #   打击音效
```

宿主把 `assets/` 托管到某个 URL（例如 `/sirius-chart-viewer/`），然后：

```vue
<script setup lang="ts">
import { SiriusChartViewer } from 'sirius-chart-viewer'
import 'sirius-chart-viewer/style.css'
</script>

<template>
  <!-- 组件会撑满父容器，父容器需要给定高度 -->
  <div style="height: 480px">
    <SiriusChartViewer
      :chart="chartBlob"
      chart-name="expert.csv"
      :music="'/api/xxx/audio'"
      asset-base="/sirius-chart-viewer/"
      autoplay
      @error="console.error"
    />
  </div>
</template>
```

| Prop | 说明 |
| --- | --- |
| `chart` | 谱面：`File` / `Blob` / `ArrayBuffer` / `Uint8Array` / URL 字符串 |
| `chart-name` | 用扩展名判断格式（`.wdschart` / `.csv` / `.sus`）；`File` 或 URL 可省略 |
| `music` | 音乐（同上），可选 |
| `music-config` | 官方 `music_config.csv`（DelaySeconds），可选 |
| `cover` | 曲绘图片，完整缩放（contain）后绘制在舞台后方的屏幕上（`ingame_bg` 中镂空的区域），可选 |
| `asset-base` | `assets/` 的托管 URL，默认 `/sirius-chart-viewer/` |
| `autoplay` | 加载完自动播放（受浏览器自动播放策略限制） |
| `fetch-init` | URL 来源的 `fetch()` 选项（如鉴权头） |

事件：`ready`、`loaded(info)`、`error(message)`、`ended`。通过 ref 可调用 `play()` / `pause()` / `toggle()` / `seek(sec)`。
组件自带播放条、设置、全屏（iOS 退化为铺满视口），按容器宽度自适应移动端。

> 宿主页面若有 CSP，`script-src` 需要包含 `'wasm-unsafe-eval'`。

### URL 参数（独立页面）

```
index.html?chart=<谱面URL>&music=<音乐URL>&cover=<曲绘URL>&config=<music_config URL>&name=<显示名>&t=<起始秒>
```

资源需允许跨域（CORS）访问。

## 架构

```
浏览器 (Vue)
  AudioTransport (Web Audio 时钟) ──► wv_frame(music_us, playing, generation)
                                        │  wasm: ChartEditorEngine.apply_timeline
                                        │        PlaybackPreviewView.sync_hit_sfx / render
                                        ├─► DrawBatch → 顶点数组 + 绘制命令 ──► GlRenderer (WebGL2)
                                        └─► SFX 命令队列 ───────────────────► SfxPlayer (Web Audio 预约播放)
```

| 目录 | 说明 |
| --- | --- |
| `third_party/wds-editor` | 上游编辑器（submodule），**不做修改** |
| `native/CMakeLists.txt` | 直接编译上游 `core/`、`chart-render/`、`renderer/src/texture.cpp`、`audio-player/src/hit_sfx.cpp`、`ui/src/regions/preview/playback_preview.cpp` |
| `native/shim/` | 以同名头文件替换上游的 Vulkan / BASS / 编辑器 UI 依赖 |
| `native/src/web_renderer.cpp` | `VulkanRenderer` 的 Web 实现：记录纹理上传与每帧绘制（pass 顺序、混合模式与 Vulkan 版一致） |
| `native/src/viewer.cpp` | 导出给 JS 的 `wv_*` 接口，对应上游 `ChartPreviewPanel` 的驱动逻辑 |
| `native/src/split_colors.cpp` | 从 `edit_gutters.cpp` 移植的分割线颜色函数（上游该文件依赖编辑器 UI） |
| `src/lib/glRenderer.ts` | `textured_quad` 着色器移植 + 管线状态 |
| `src/lib/audioTransport.ts` | 音乐时钟（按可听时间驱动画面，SFX 用 AudioContext 时间精确预约） |
| `src/lib/sfx.ts` | 执行 wasm 发出的打击音命令 |
| `src/components/SiriusChartViewer.vue` | 可嵌入的播放器组件（`src/index.ts` 为库入口） |

皮肤 PNG 在编译时通过 `--preload-file` 打进 `sirius-viewer.data`；打击音效由 `scripts/sync-assets.mjs`
从 submodule 复制到 `public/effects/`。

### 跟进上游

```bash
git -C third_party/wds-editor pull origin main
npm run build:wasm
```

编译失败时通常是上游改了 `PlaybackPreviewView` 用到的接口：按报错更新 `native/shim/` 或 `native/src/split_colors.cpp`。

## 已知差异

- 长按持续音按帧（约 16ms）开关，未实现 BASS 版的 hold gate 精确边沿。
- 不支持 `.wdsproject`（需要多文件）；请直接加载其中的 `.wdschart` 和音乐。
- 仅预览，不含编辑功能。
- 打击音效为 ogg；不支持 Ogg Vorbis 的旧版 Safari 上没有打击音（音乐不受影响）。
