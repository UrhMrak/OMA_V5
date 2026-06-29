import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base keeps asset URLs working both on a GitHub Pages project
// subpath (https://user.github.io/repo/) and later on a root custom domain.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173
  }
});


