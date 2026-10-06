import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths let the build run from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react()]
});
