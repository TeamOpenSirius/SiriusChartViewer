import { reactive, watch } from 'vue'
import type { DisplaySettings, ViewerOptions } from './viewer'

export interface Settings extends DisplaySettings, ViewerOptions {
  musicVolume: number
  sfxVolume: number
  playbackRate: number
}

// Defaults follow wds-editor PreviewVisualConfig / official GameSettings.
export const DEFAULT_SETTINGS: Settings = {
  noteSpeed: 5,
  noteStartOffset: 0,
  noteHeightLevel: 8,
  splitLineOpacity: 100,
  muteHoldBodySfx: false,
  showJudgmentText: false,
  musicVolume: 0.8,
  sfxVolume: 0.7,
  playbackRate: 1,
}

const STORAGE_KEY = 'sirius-chart-viewer.settings'

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore corrupt storage
  }
  return { ...DEFAULT_SETTINGS }
}

export function useSettings() {
  const settings = reactive<Settings>(load())
  watch(settings, (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s)), { deep: true })
  return settings
}
