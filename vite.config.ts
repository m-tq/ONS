import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/octra': {
        target: 'https://octra.network',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/octra/, ''),
        secure: true,
        headers: {
          'User-Agent': 'ONS-DApp/1.0'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            // Proxy error handling
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Request logging
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Response logging
          });
        }
      }
    }
  }
})