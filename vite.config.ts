import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // esbuild minification options (Vite 7 uses esbuild by default, not Terser)
    // In production: drop console.log/warn/debug/info but keep console.error
    // so critical errors remain visible in crash reports.
    esbuildOptions: mode === 'production' ? {
      drop: ['debugger'],
      pure: ['console.log', 'console.warn', 'console.debug', 'console.info'],
    } : undefined,

    rollupOptions: {
      output: {
        // Code-split large chunks for faster initial load and better caching.
        // nostr-tools and tiptap are lazy-loaded so they go to separate chunks.
        manualChunks(id) {
          if (id.includes('nostr-tools')) return 'nostr'
          if (id.includes('tiptap') || id.includes('@tiptap')) return 'tiptap'
        },
      },
    },
  },
}))
