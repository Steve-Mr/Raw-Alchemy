import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon-512x512.png', 'libraw.wasm'],
      manifest: {
        name: 'Nitrate Grain',
        short_name: 'Nitrate Grain',
        description: 'Shadows with a pulse',
        // theme_color removed to allow dynamic meta tag to take precedence for status bar
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
            {
                src: 'screenshot-desktop.png',
                sizes: '1920x1080',
                type: 'image/png',
                form_factor: 'wide',
                label: 'Desktop Interface'
            },
            {
                src: 'screenshot-mobile.png',
                sizes: '375x812',
                type: 'image/png',
                form_factor: 'narrow',
                label: 'Mobile Interface'
            }
        ],
        share_target: {
            action: '/_share-target',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
                title: 'name',
                text: 'description',
                url: 'link',
                files: [
                    {
                        name: 'file',
                        accept: ['image/*', 'application/octet-stream']
                    }
                ]
            }
        }
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    })
  ],
})
