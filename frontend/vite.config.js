import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/games-api': {
        target: 'http://localhost:8002/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/games-api/, ''),
      },
      '/stats-api': {
        target: 'http://localhost:8003/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/stats-api/, ''),
      },
    },
  },
})
