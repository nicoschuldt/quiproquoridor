import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
const backendWsUrl = process.env.VITE_BACKEND_WS_URL || 'ws://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, '../shared/types'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['weekly-famous-wren.ngrok-free.app'],
    proxy: {
      '/api': {
        target: backendUrl.startsWith('http') ? backendUrl : `http://${backendUrl}`,
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: backendWsUrl.startsWith('ws') ? backendWsUrl : `ws://${backendWsUrl}`,
        ws: true,
      },
    },
  },
});
