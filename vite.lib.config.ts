// Library build: the embeddable <SiriusChartViewer> component (Vue is a peer dependency).
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Runtime assets (wasm / effects) are copied by scripts/build-lib.mjs and served by the host app.
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'sirius-chart-viewer.js',
      cssFileName: 'sirius-chart-viewer',
    },
    rollupOptions: {
      external: ['vue'],
    },
  },
})
