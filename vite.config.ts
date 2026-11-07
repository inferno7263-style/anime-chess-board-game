import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: { '/socket.io': { target: process.env.MULTIPLAYER_PROXY_TARGET || 'http://127.0.0.1:3001', ws: true } },
  },
  build: { chunkSizeWarningLimit: 1600 },
});
