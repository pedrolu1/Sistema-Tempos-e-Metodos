import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // caminho relativo: o mesmo build roda na raiz de um domínio ou num subcaminho
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          motion: ['motion/react']
        }
      }
    }
  }
});
