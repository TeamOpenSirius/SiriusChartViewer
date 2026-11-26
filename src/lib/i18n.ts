import { computed, ref } from 'vue'

export type Locale = 'zh' | 'en'

const STORAGE_KEY = 'sirius-chart-viewer.locale'

export function detectSystemLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const langs = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language]
  const first = (langs.find(Boolean) ?? '').toLowerCase()
  return first.startsWith('zh') ? 'zh' : 'en'
}

function loadInitialLocale(): Locale {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'zh' || saved === 'en') return saved
    }
  } catch {
    // ignore storage errors
  }
  return detectSystemLocale()
}

const currentLocale = ref<Locale>(loadInitialLocale())

function syncDocumentLang(loc: Locale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en'
  }
}

syncDocumentLang(currentLocale.value)

export function getLocale(): Locale {
  return currentLocale.value
}

export function setLocale(loc: Locale) {
  currentLocale.value = loc
  syncDocumentLang(loc)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, loc)
    }
  } catch {
    // ignore storage errors
  }
}

export function toggleLocale() {
  setLocale(currentLocale.value === 'zh' ? 'en' : 'zh')
}

const MESSAGES = {
  zh: {
    app: {
      chipChart: '谱面',
      chipMusic: '音乐',
      chipConfig: '配置',
      chipCover: '封面',
      removeMusic: '移除音乐',
      removeConfig: '移除配置',
      removeCover: '移除封面',
      openFiles: '打开文件',
      about: '关于',
      aboutTitle: '关于项目',
      switchLangTitle: '切换为 English',
      emptyTitle: '拖入谱面文件，或点击此处选择',
      emptyDesc: '支持同时选择或拖入谱面、音频、封面图与时间配置文件',
      dropHint: '松开鼠标以加载文件',
    },
    viewer: {
      initEngine: '正在初始化预览引擎与音效…',
      initEngineSub: '首次加载需下载 WebAssembly 核心与打击音效',
      waitPending: '正在等待谱面与媒体资源…',
      waitPendingSub: '等待外部数据源就绪',
      pleaseWait: '请稍候',
      readingPrefix: '正在读取',
      readingSuffix: '…',
      targetChart: '谱面',
      targetMusic: '音乐',
      targetCover: '封面',
      targetConfig: '配置',
      targetResources: '资源',
      listSep: '、',
      decodingAudioAndCover: '正在解码音频并处理封面…',
      decodingAudio: '正在解码音频…',
      processingCover: '正在处理封面图像…',
      parsingChart: '正在解析谱面数据…',
      noChart: '没有谱面',
      play: '播放',
      pause: '暂停',
      seek: '进度',
      comboTitle: '当前 Combo / 总 Note 数',
      playbackRate: '播放速度',
      settings: '设置',
      settingsTitle: '显示与声音设置',
      fullscreen: '全屏',
      fullscreenTitle: '全屏 (F)',
      exitFullscreen: '退出全屏',
      exitFullscreenTitle: '退出全屏 (F)',
      retry: '重试加载',
    },
    settings: {
      ariaLabel: '显示与声音设置',
      title: '显示与声音',
      close: '关闭 (Esc)',
      closeAria: '关闭设置',
      sectionDisplay: '谱面显示',
      noteSpeed: '流速',
      laneCover: '挡板',
      noteThickness: 'Note 厚度',
      splitLineOpacity: '分割线特效透明度',
      showJudgmentText: '显示判定文字',
      sectionAudio: '声音',
      musicVolume: '音乐音量',
      sfxVolume: '打击音量',
      muteHoldBodySfx: '静音长按持续音',
      reset: '恢复默认设置',
    },
    about: {
      close: '关闭 (Esc)',
      closeAria: '关闭关于窗口',
      description: '基于 wds-editor 预览内核的 World Dai Star 网页 3D 谱面预览器，使用 WebAssembly、WebGL2 与 Web Audio API 还原桌面端预览体验。',
      repository: '开源仓库',
      upstream: '上游预览核心',
      license: '开源许可证',
      shortcuts: '快捷键',
      scPlayPause: '播放 / 暂停',
      scSeek5: '快退 / 快进 5 秒',
      scSeek1: '微调 1 秒',
      scHome: '回到开头',
      scFullscreen: '切换全屏',
      scDblClickKey: '双击画面',
      scDblClick: '切换全屏',
      footerNote: '本软件依据 GPL v3 许可证开源发布',
      ok: '关闭',
    },
    errors: {
      downloadFailed: (status: number, url: string) => `下载失败 ${status}: ${url}`,
      initFailed: (detail: string) => `预览初始化失败：${detail}`,
      chartLoadFailed: (detail: string) => `谱面加载失败：${detail}`,
      coverRenderFailed: '封面绘制失败',
      sfxLoadFailed: (status: number, name: string) => `音效加载失败 ${status}: ${name}`,
      holdLoopLoadFailed: (status: number) => `长按音效配置加载失败 ${status}`,
      holdLoopInvalid: '长按音效配置无效',
    },
  },
  en: {
    app: {
      chipChart: 'Chart',
      chipMusic: 'Music',
      chipConfig: 'Config',
      chipCover: 'Cover',
      removeMusic: 'Remove music',
      removeConfig: 'Remove config',
      removeCover: 'Remove cover',
      openFiles: 'Open Files',
      about: 'About',
      aboutTitle: 'About this project',
      switchLangTitle: 'Switch to 中文',
      emptyTitle: 'Drop chart files here, or click to browse',
      emptyDesc: 'Drop or select a chart along with optional audio, jacket art, and music_config.csv',
      dropHint: 'Release to load files',
    },
    viewer: {
      initEngine: 'Initializing preview engine & SFX…',
      initEngineSub: 'First load downloads WebAssembly core & hit sounds',
      waitPending: 'Waiting for chart & media sources…',
      waitPendingSub: 'Waiting for host data',
      pleaseWait: 'Please wait',
      readingPrefix: 'Loading ',
      readingSuffix: '…',
      targetChart: 'chart',
      targetMusic: 'music',
      targetCover: 'cover',
      targetConfig: 'config',
      targetResources: 'resources',
      listSep: ', ',
      decodingAudioAndCover: 'Decoding audio & processing cover…',
      decodingAudio: 'Decoding audio…',
      processingCover: 'Processing cover image…',
      parsingChart: 'Parsing chart data…',
      noChart: 'No chart loaded',
      play: 'Play',
      pause: 'Pause',
      seek: 'Seek',
      comboTitle: 'Current Combo / Total Notes',
      playbackRate: 'Playback speed',
      settings: 'Settings',
      settingsTitle: 'Display & Audio Settings',
      fullscreen: 'Fullscreen',
      fullscreenTitle: 'Fullscreen (F)',
      exitFullscreen: 'Exit fullscreen',
      exitFullscreenTitle: 'Exit fullscreen (F)',
      retry: 'Retry',
    },
    settings: {
      ariaLabel: 'Display and audio settings',
      title: 'Display & Audio',
      close: 'Close (Esc)',
      closeAria: 'Close settings',
      sectionDisplay: 'Chart Display',
      noteSpeed: 'Note Speed',
      laneCover: 'Lane Cover',
      noteThickness: 'Note Thickness',
      splitLineOpacity: 'Split Line Opacity',
      showJudgmentText: 'Show Judgment Text',
      sectionAudio: 'Audio',
      musicVolume: 'Music Volume',
      sfxVolume: 'SFX Volume',
      muteHoldBodySfx: 'Mute Hold Loop SFX',
      reset: 'Reset to Defaults',
    },
    about: {
      close: 'Close (Esc)',
      closeAria: 'Close About dialog',
      description: 'A browser-based 3D chart previewer for World Dai Star powered by the wds-editor preview core, using WebAssembly, WebGL2, and the Web Audio API.',
      repository: 'Repository',
      upstream: 'Upstream Core',
      license: 'License',
      shortcuts: 'Keyboard Shortcuts',
      scPlayPause: 'Play / Pause',
      scSeek5: 'Seek ±5s',
      scSeek1: 'Seek ±1s',
      scHome: 'Jump to start',
      scFullscreen: 'Toggle fullscreen',
      scDblClickKey: 'Double-click',
      scDblClick: 'Toggle fullscreen',
      footerNote: 'Released under the GNU GPL v3 license',
      ok: 'Close',
    },
    errors: {
      downloadFailed: (status: number, url: string) => `Download failed (${status}): ${url}`,
      initFailed: (detail: string) => `Preview initialization failed: ${detail}`,
      chartLoadFailed: (detail: string) => `Failed to load chart: ${detail}`,
      coverRenderFailed: 'Failed to render cover image',
      sfxLoadFailed: (status: number, name: string) => `Failed to load SFX (${status}): ${name}`,
      holdLoopLoadFailed: (status: number) => `Failed to load hold loop config (${status})`,
      holdLoopInvalid: 'Invalid hold loop config',
    },
  },
} as const

export type Messages = (typeof MESSAGES)[Locale]

export function getMessages(): Messages {
  return MESSAGES[currentLocale.value]
}

export function useI18n() {
  const t = computed(() => MESSAGES[currentLocale.value])
  return {
    locale: currentLocale,
    t,
    setLocale,
    toggleLocale,
  }
}
