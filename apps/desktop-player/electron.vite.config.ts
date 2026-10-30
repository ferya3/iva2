import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Workspace packages ship TypeScript sources: bundle them, externalize the rest.
const bundled = {
  exclude: [
    '@cognitest/assessment-engine',
    '@cognitest/event-recorder',
    '@cognitest/shared-types',
    '@cognitest/timing-core',
    '@cognitest/validation',
    'zod',
  ],
};

export default defineConfig({
  main: {
    build: {
      externalizeDeps: bundled,
      lib: { entry: resolve(import.meta.dirname, 'electron/main.ts'), formats: ['es'] },
      outDir: 'out/main',
    },
  },
  preload: {
    build: {
      externalizeDeps: bundled,
      // Sandboxed preloads must be CommonJS.
      lib: {
        entry: resolve(import.meta.dirname, 'electron/preload.ts'),
        formats: ['cjs'],
        fileName: () => 'preload.cjs',
      },
      outDir: 'out/preload',
    },
  },
  renderer: {
    root: resolve(import.meta.dirname, 'src'),
    plugins: [react(), tailwindcss()],
    build: {
      outDir: resolve(import.meta.dirname, 'out/renderer'),
      emptyOutDir: true,
      rollupOptions: { input: resolve(import.meta.dirname, 'src/index.html') },
    },
  },
});
