<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from '../lib/i18n'
import { PROJECT_INFO } from '../lib/projectInfo'

const emit = defineEmits<{ close: [] }>()
const logoUrl = `${import.meta.env.BASE_URL}logo.png`
const { t } = useI18n()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="about-backdrop" role="presentation" @click.self="emit('close')">
    <div class="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <header class="about-header">
        <div class="about-brand">
          <img class="about-logo" :src="logoUrl" alt="Sirius Chart Viewer" />
          <div>
            <div class="about-title-row">
              <h2 id="about-title">{{ PROJECT_INFO.name }}</h2>
              <span class="about-version">v{{ PROJECT_INFO.version }}</span>
            </div>
            <p class="about-pkg">{{ PROJECT_INFO.packageName }}</p>
          </div>
        </div>
        <button class="about-close" type="button" :title="t.about.close" :aria-label="t.about.closeAria" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div class="about-body">
        <p class="about-desc">{{ t.about.description }}</p>

        <div class="about-tags">
          <span v-for="tech in PROJECT_INFO.techStack" :key="tech" class="about-tag">{{ tech }}</span>
        </div>

        <dl class="about-meta">
          <div class="about-row">
            <dt>{{ t.about.repository }}</dt>
            <dd>
              <a :href="PROJECT_INFO.repositoryUrl" target="_blank" rel="noopener noreferrer">
                TeamOpenSirius/SiriusChartViewer
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </dd>
          </div>
          <div class="about-row">
            <dt>{{ t.about.upstream }}</dt>
            <dd>
              <a :href="PROJECT_INFO.upstreamUrl" target="_blank" rel="noopener noreferrer">
                TeamOpenSirius/wds-editor
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </dd>
          </div>
          <div class="about-row">
            <dt>{{ t.about.license }}</dt>
            <dd>
              <a :href="PROJECT_INFO.licenseUrl" target="_blank" rel="noopener noreferrer" class="about-license">
                {{ PROJECT_INFO.license }}
              </a>
            </dd>
          </div>
        </dl>

        <section class="about-shortcuts">
          <h3>{{ t.about.shortcuts }}</h3>
          <div class="shortcut-grid">
            <div class="shortcut-item"><kbd>Space</kbd><span>{{ t.about.scPlayPause }}</span></div>
            <div class="shortcut-item"><kbd>←</kbd><kbd>→</kbd><span>{{ t.about.scSeek5 }}</span></div>
            <div class="shortcut-item"><kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd><span>{{ t.about.scSeek1 }}</span></div>
            <div class="shortcut-item"><kbd>Home</kbd><span>{{ t.about.scHome }}</span></div>
            <div class="shortcut-item"><kbd>F</kbd><span>{{ t.about.scFullscreen }}</span></div>
            <div class="shortcut-item"><kbd>{{ t.about.scDblClickKey }}</kbd><span>{{ t.about.scDblClick }}</span></div>
          </div>
        </section>
      </div>

      <footer class="about-footer">
        <span class="about-note">{{ t.about.footerNote }}</span>
        <button class="about-ok" type="button" @click="emit('close')">{{ t.about.ok }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.about-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(5, 6, 12, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.about-dialog {
  width: min(500px, 100%);
  max-height: min(90vh, 680px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: linear-gradient(180deg, #171a2b 0%, #111320 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.62), 0 0 0 1px rgba(124, 140, 255, 0.08) inset;
  overflow: hidden;
}
.about-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}
.about-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.about-logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12);
}
.about-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.about-title-row h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.about-version {
  font-size: 11.5px;
  font-weight: 600;
  color: #b7c2ff;
  background: rgba(124, 140, 255, 0.16);
  border: 1px solid rgba(124, 140, 255, 0.34);
  border-radius: 999px;
  padding: 2px 8px;
  font-variant-numeric: tabular-nums;
}
.about-pkg {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.about-close {
  flex: none;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.about-close:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--border);
}
.about-body {
  padding: 18px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.about-desc {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.65;
  color: #cfd4e8;
}
.about-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.about-tag {
  font-size: 11.5px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 3px 10px;
}
.about-meta {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.about-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.about-row dt {
  flex: none;
  color: var(--muted);
}
.about-row dd {
  margin: 0;
  text-align: right;
  min-width: 0;
}
.about-row a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #9ba8ff;
  text-decoration: none;
  word-break: break-all;
}
.about-row a:hover {
  color: #bfc8ff;
  text-decoration: underline;
}
.about-license {
  font-weight: 500;
}
.about-shortcuts h3 {
  margin: 0 0 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.shortcut-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #cfd4e8;
}
.shortcut-item kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  padding: 2px 6px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--text);
  background: var(--panel-2);
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
}
.about-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 20px;
  border-top: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.16);
}
.about-note {
  font-size: 12px;
  color: var(--muted);
}
.about-ok {
  background: var(--panel-2);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.about-ok:hover {
  background: #252a42;
  border-color: rgba(255, 255, 255, 0.24);
}
@media (max-width: 480px) {
  .about-row {
    flex-direction: column;
    gap: 2px;
  }
  .about-row dd {
    text-align: left;
  }
  .shortcut-grid {
    grid-template-columns: 1fr;
  }
}
</style>
