import { defineConfig } from 'vite';

// `--mode content` or `--mode background`: one self-contained IIFE each,
// since MV3 content scripts cannot load ES module chunks.
export default defineConfig(({ mode }) => ({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: `src/${mode}/index.ts`,
      name: `earsup_${mode}`,
      formats: ['iife'],
      fileName: () => `${mode}.js`,
    },
  },
}));
