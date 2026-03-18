import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    target: 'es2017',
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'main',
      fileName: () => 'main.js',
      formats: ['cjs']
    },
    rollupOptions: {
      output: { entryFileNames: 'main.js' }
    },
    minify: false
  }
});