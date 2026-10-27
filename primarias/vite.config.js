import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// App Primárias: mora na pasta primarias/ e reaproveita o código do Tempos &
// Métodos (src/) por import relativo. As dependências são as da raiz, então
// Firebase e bibliotecas ficam numa cópia só. Sai em dist-primarias/, que é
// publicado num site próprio da Netlify (PRIMARIAS_SAIDA troca a pasta de saída
// quando a própria Netlify monta o site; ver netlify.toml).
const raiz = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: raiz,
  base: './',
  define: { __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: process.env.PRIMARIAS_SAIDA || '../dist-primarias',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 700
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'REFRAMAX Primárias',
        short_name: 'Primárias',
        description: 'Lançamento e acompanhamento da substituição das válvulas primárias dos fornos da coqueria.',
        theme_color: '#14100e',
        background_color: '#14100e',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
      }
    })
  ]
});
