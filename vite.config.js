import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: { target: 'es2020', assetsInlineLimit: 0 },
  server: { host: '127.0.0.1' },
});
