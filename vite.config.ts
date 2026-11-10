import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Options page (React). Content + background scripts build separately
// as single IIFE files via vite.scripts.config.ts.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { options: 'options.html' } },
  },
});
