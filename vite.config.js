import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://cartsy-ht0x.onrender.com',
        changeOrigin: true,
      },
      '/orders': {
        target: 'https://cartsy-ht0x.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
