import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist',
    target: 'es2020',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'src/renderer/index.html',
        interface: 'src/renderer/interface.html',
        launch: 'src/renderer/launch.html'
      }
    }
  },
  server: {
    port: 5173,
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 5173,
    }
  }
})
