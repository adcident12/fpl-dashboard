import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves project sites from a subpath (adcident12.github.io/fpl-dashboard/),
// so a build meant for Pages needs that as its base — but the local dev server
// AND `npm start`'s single-process mode (server/index.js serving client/dist
// from its own root) both need root-relative `/`. Only the GitHub Actions
// Pages workflow sets GITHUB_PAGES=true; a plain `npm run build` for the
// single-process deployment is unaffected.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/fpl-dashboard/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
