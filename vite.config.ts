import { defineConfig } from 'vite'

export default defineConfig({
  // Portallar (Poki / CrazyGames) oyunu bir alt klasörden servis eder.
  // Mutlak yol kullanırsan build orada çalışmaz.
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Phaser'ı ayrı chunk'ta tut: oyun kodu değiştiğinde tarayıcı
        // önbelleği motoru yeniden indirmesin.
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  server: { host: true, port: 5173 },
})
