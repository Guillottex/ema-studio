import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const engine = process.env.ENGINE_SRC || resolve(__dirname, '../scorm-engine/src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': resolve(engine, 'index.ts'),
      '@engine-css': resolve(engine, 'css/player.css'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [resolve(__dirname, '..')] },
    proxy: {
      '/api': { target: process.env.API_URL || 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: process.env.API_URL || 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], vendor: ['@tanstack/react-query', 'zustand', 'immer', 'dompurify'] },
      },
    },
  },
});
