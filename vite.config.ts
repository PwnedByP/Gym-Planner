import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRITICAL for GitHub Pages: 
  // This ensures assets are loaded relative to the index.html, 
  // preventing 404 errors when hosted on a subdirectory (e.g. /gym-app/)
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});