import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve(process.cwd(), 'admin'),
  envDir: process.cwd(),
  publicDir: resolve(process.cwd(), 'public'),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    fs: {
      allow: [process.cwd()],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
  },
  build: {
    outDir: resolve(process.cwd(), 'dist-admin'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(process.cwd(), 'admin/index.html'),
    },
  },
});
