import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Relative base so the build can be hosted under any sub-path (e.g. inside SiriusNet).
  base: './',
  plugins: [vue()],
})
