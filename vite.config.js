import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // versão = data/hora do build: aparece nos registros de saúde para saber em qual versão a falha ocorreu
  define: { __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  // caminho relativo: o mesmo build funciona tanto na raiz de um domínio
  // (Vercel/Netlify) quanto num subcaminho (ex.: GitHub Pages de projeto)
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // helpers do próprio Vite ficam num pedaço base — senão o Rollup os
          // coloca dentro de uma biblioteca de exportação e a página inicial
          // passa a baixá-la junto
          if (/preload-helper|commonjsHelpers/.test(id)) return 'base';
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'firebase';
          // bibliotecas de exportação (Excel, PDF, Word, PowerPoint): só o painel usa,
          // e só na hora de exportar — ficam em pedaços próprios, fora do pacote offline
          const exp = id.match(/node_modules\/(xlsx|jspdf|jspdf-autotable|html2canvas|canvg|dompurify|docx|pptxgenjs)\//);
          if (exp) return `exp-${{ 'jspdf-autotable': 'jspdf', html2canvas: 'jspdf', canvg: 'jspdf', dompurify: 'jspdf' }[exp[1]] || exp[1]}`;
        }
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'REFRAMAX — Tempos & Métodos',
        short_name: 'REFRAMAX',
        description: 'Lançamento, gestão e análise de Tempos e Métodos industriais.',
        theme_color: '#0b0c0f',
        background_color: '#0b0c0f',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // as bibliotecas de exportação (~1,7 MB) só são usadas no painel, com
        // internet: ficam fora do pacote offline para a instalação no celular
        // ser leve. Elas baixam sob demanda na primeira exportação.
        globIgnores: ['**/exp-*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin.includes('firestore.googleapis.com') || url.origin.includes('googleapis.com'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cronos-api-cache',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
});
