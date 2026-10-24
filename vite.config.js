import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : '/soccer-club-mgr/',
  build: {
    rollupOptions: {
      // liff.html は LINE の中で開く画面（LIFF）。既存の index.html とは別の入口
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        liff: resolve(import.meta.dirname, 'liff.html'),
      },
    },
  },
})
