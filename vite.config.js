import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'Icone_CareTools.png'],
      manifest: {
        name: 'CareTools',
        short_name: 'CareTools',
        description: 'Orthopedic Solutions, Made Simple',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'Icone_CareTools.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'Icone_CareTools.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})