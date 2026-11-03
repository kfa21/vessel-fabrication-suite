import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The cloud preview proxy forwards the workspace hostname in the Host header.
// It is supplied at runtime rather than committed to the repository.
const allowedHosts = (process.env.PREVIEW_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  // Relative asset URLs work both at the domain root (Cloudflare Sites) and
  // under /<repo>/ on GitHub Pages.
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
  },
});
