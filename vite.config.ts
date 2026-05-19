import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // In production, API calls go to the Azure backend
  define: command === 'build' ? {
    '__API_BASE__': JSON.stringify(
      process.env.VITE_API_URL ?? ''
    ),
  } : {
    '__API_BASE__': JSON.stringify(''),
  },
}))
