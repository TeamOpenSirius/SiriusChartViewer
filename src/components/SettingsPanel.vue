<script setup lang="ts">
import { DEFAULT_SETTINGS, type Settings } from '../lib/settings'

const settings = defineModel<Settings>({ required: true })
defineEmits<{ close: [] }>()

function reset() {
  Object.assign(settings.value, DEFAULT_SETTINGS)
}
</script>

<template>
  <aside class="panel">
    <header>
      <h2>显示与声音</h2>
      <button class="icon" title="关闭" @click="$emit('close')">✕</button>
    </header>

    <section>
      <h3>谱面显示</h3>
      <label>
        <span>流速 <b>{{ settings.noteSpeed.toFixed(1) }}</b></span>
        <input v-model.number="settings.noteSpeed" type="range" min="1" max="25" step="0.1" />
      </label>
      <label>
        <span>挡板 <b>{{ settings.noteStartOffset }}</b></span>
        <input v-model.number="settings.noteStartOffset" type="range" min="0" max="100" step="5" />
      </label>
      <label>
        <span>Note 厚度 <b>{{ settings.noteHeightLevel }}</b></span>
        <input v-model.number="settings.noteHeightLevel" type="range" min="1" max="10" step="1" />
      </label>
      <label>
        <span>分割线特效透明度 <b>{{ settings.splitLineOpacity }}%</b></span>
        <input v-model.number="settings.splitLineOpacity" type="range" min="10" max="100" step="10" />
      </label>
      <label class="check">
        <input v-model="settings.showJudgmentText" type="checkbox" />
        <span>显示判定文字</span>
      </label>
    </section>

    <section>
      <h3>声音</h3>
      <label>
        <span>音乐音量 <b>{{ Math.round(settings.musicVolume * 100) }}</b></span>
        <input v-model.number="settings.musicVolume" type="range" min="0" max="1" step="0.01" />
      </label>
      <label>
        <span>打击音量 <b>{{ Math.round(settings.sfxVolume * 100) }}</b></span>
        <input v-model.number="settings.sfxVolume" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="check">
        <input v-model="settings.muteHoldBodySfx" type="checkbox" />
        <span>静音长按持续音</span>
      </label>
    </section>

    <footer>
      <button class="ghost" @click="reset">恢复默认</button>
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  width: 300px;
  background: var(--panel);
  border-left: 1px solid var(--border);
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  font-size: 16px;
  margin: 0;
}
h3 {
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 10px;
}
section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
label span {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
}
label b {
  color: var(--text);
  font-weight: 600;
}
label.check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}
input[type='checkbox'] {
  accent-color: var(--accent);
}
.icon {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 16px;
}
.ghost {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 12px;
}
</style>
