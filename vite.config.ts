import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const basePath = env.VITE_BASE_PATH || '/';
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const disablePwa = env.VITE_DISABLE_PWA === 'true' || process.cwd().includes("'");

  return {
    base: normalizedBasePath,
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-motion': ['motion/react'],
            'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
            'vendor-charts': ['recharts'],
            'vendor-supabase': ['@supabase/supabase-js']
          }
        }
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        disable: disablePwa,
        registerType: 'autoUpdate',
        includeAssets: ['app-logo.svg'],
        manifest: {
          name: 'Bunbietbay Trips',
          short_name: 'BB Trips',
          description: 'Hành trang du lịch và quản lý chi tiêu',
          theme_color: '#f8fafc',
          background_color: '#f8fafc',
          display: 'standalone',
          icons: [
            {
              src: 'app-logo.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: 'app-logo.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
          // Force new SW to activate immediately — prevents serving stale chunks after deploy
          skipWaiting: true,
          clientsClaim: true,
          // Remove old precache entries when a new SW version is deployed
          cleanupOutdatedCaches: true,
          runtimeCaching: [{
            urlPattern: /^https:\/\/res\.cloudinary\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'bunbietbay-offline-photos', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 }, cacheableResponse: { statuses: [0, 200] } },
          }],
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
