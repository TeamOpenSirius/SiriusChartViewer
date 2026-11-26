<script setup lang="ts">
import { DEFAULT_SETTINGS, type Settings } from '../lib/settings'

const settings = defineModel<Settings>({ required: true })
defineEmits<{ close: [] }>()

function reset() {
  Object.assign(settings.value, DEFAULT_SETTINGS)
}
</script>

<template>
  <aside class="panel" aria-label="显示与声音设置">
    <header class="panel__header">
      <h2>显示与声音</h2>
      <button class="icon-btn" type="button" title="关闭 (Esc)" aria-label="关闭设置" @click="$emit('close')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </header>

    <div class="panel__body">
      <section class="group">
        <h3>谱面显示</h3>
        <label class="field">
          <span class="field__label">
            <span>流速</span>
            <b class="badge">{{ settings.noteSpeed.toFixed(1) }}</b>
          </span>
          <input v-model.number="settings.noteSpeed" type="range" min="1" max="25" step="0.1" />
        </label>

        <label class="field">
          <span class="field__label">
            <span>挡板</span>
            <b class="badge">{{ settings.noteStartOffset }}</b>
          </span>
          <input v-model.number="settings.noteStartOffset" type="range" min="0" max="100" step="5" />
        </label>

        <label class="field">
          <span class="field__label">
            <span>Note 厚度</span>
            <b class="badge">{{ settings.noteHeightLevel }}</b>
          </span>
          <input v-model.number="settings.noteHeightLevel" type="range" min="1" max="10" step="1" />
        </label>

        <label class="field">
          <span class="field__label">
            <span>分割线特效透明度</span>
            <b class="badge">{{ settings.splitLineOpacity }}%</b>
          </span>
          <input v-model.number="settings.splitLineOpacity" type="range" min="10" max="100" step="10" />
        </label>

        <label class="toggle">
          <span>显示判定文字</span>
          <input v-model="settings.showJudgmentText" type="checkbox" />
          <span class="toggle__track" aria-hidden="true" />
        </label>
      </section>

      <section class="group">
        <h3>声音</h3>
        <label class="field">
          <span class="field__label">
            <span>音乐音量</span>
            <b class="badge">{{ Math.round(settings.musicVolume * 100) }}%</b>
          </span>
          <input v-model.number="settings.musicVolume" type="range" min="0" max="1" step="0.01" />
        </label>

        <label class="field">
          <span class="field__label">
            <span>打击音量</span>
            <b class="badge">{{ Math.round(settings.sfxVolume * 100) }}%</b>
          </span>
          <input v-model.number="settings.sfxVolume" type="range" min="0" max="1" step="0.01" />
        </label>

        <label class="toggle">
          <span>静音长按持续音</span>
          <input v-model="settings.muteHoldBodySfx" type="checkbox" />
          <span class="toggle__track" aria-hidden="true" />
        </label>
      </section>
    </div>

    <footer class="panel__footer">
      <button class="ghost" type="button" @click="reset">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        <span>恢复默认设置</span>
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  width: 312px;
  background: rgba(16, 18, 30, 0.9);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-left: 1px solid var(--border);
  box-shadow: -12px 0 36px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
}
.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
h2 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.01em;
}
.panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 13px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
h3 {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 2px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.field__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--muted);
}
.badge {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  background: rgba(124, 140, 255, 0.14);
  border: 1px solid rgba(124, 140, 255, 0.25);
  border-radius: 6px;
  padding: 1px 7px;
}
input[type='range'] {
  width: 100%;
  height: 18px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  padding-top: 2px;
}
.toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle__track {
  position: relative;
  flex: none;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.18s ease, border-color 0.18s ease;
}
.toggle__track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: transform 0.18s ease;
}
.toggle input:checked + .toggle__track {
  background: var(--accent-2);
  border-color: var(--accent);
}
.toggle input:checked + .toggle__track::after {
  transform: translateX(16px);
}
.icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--muted);
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.icon-btn:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--border);
}
.panel__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}
.ghost {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.ghost:hover {
  border-color: var(--border-strong);
  background: #23273d;
}
</style>
