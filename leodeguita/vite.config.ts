import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Leodeguita runs as its own Vite app, separate from `frontend/`. Port 5174 is
// already whitelisted in the backend CORS config (backend/config/cors.php), so
// the dev server can call the shared API without extra setup.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Leodeguita',
        short_name: 'Leodeguita',
        description: 'Companion mobile app for Leodega',
        theme_color: '#7551E9',
        background_color: '#ECEDF3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5174,
  },
  build: {
    outDir: 'dist',
  },
})
