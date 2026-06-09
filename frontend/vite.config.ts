import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.BACKEND_API_URL || 'http://backend:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: process.env.BACKEND_API_URL || 'http://backend:3000',
        ws: true,
        changeOrigin: true
      }
    },
    watch: {
      usePolling: true
    }
  }
})
