import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: [
          'growy-favicon.ico',
          'growy-apple-touch-icon-180.png',
          'growy-icon-32.png',
          'growy-icon-192.png',
          'growy-icon-512.png',
          'growy-icon-maskable-512.png',
          'favicon.ico',
          'apple-touch-icon.png',
        ],
        manifest: {
          id: '/',
          name: 'GROWy.',
          short_name: 'GROWy',
          description:
            'GROWy — Impulso el crecimiento de tu negocio. Calculadora de punto de equilibrio, metas de ganancia y proyecciones mes a mes.',
          theme_color: '#FDF4F5',
          background_color: '#FFFFFF',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          start_url: '/',
          scope: '/',
          lang: 'es',
          icons: [
            {
              src: '/growy-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/growy-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/growy-icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        injectManifest: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Permitir los dominios dinámicos de vista previa (Cloud Run / AI Studio)
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
