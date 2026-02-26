import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/tools/clairify/',
  resolve: {
    alias: {
      '@oracle/shared': path.resolve(__dirname, '../dashboard-shared'),
      '@relume_io/relume-ui': path.resolve(__dirname, 'node_modules/@relume_io/relume-ui'),
    },
  },
  build: {
    outDir: '../public/tools/clairify',
    emptyOutDir: true,
  },
  server: {
    port: 5178,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
