import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The app ships as ONE self-contained file (index.html): it must still work when it is
// opened from disk, uploaded somewhere, or shown inside an HTML viewer. `pnpm build`
// writes dist/index.html and copies it to the repository root, where GitHub Pages serves it.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  base: './',
  plugins: [viteSingleFile()],
  build: {
    // Keep the deployed file readable: it is the code that people open and read.
    minify: false,
    cssMinify: false,
    // One inline module script needs no preload polyfill.
    modulePreload: { polyfill: false },
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, 'src/index.html') },
  },
  server: { open: '/' },
});
