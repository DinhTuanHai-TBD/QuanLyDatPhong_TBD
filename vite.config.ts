import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://cos-arrangement-sperm-magnitude.trycloudflare.com'),
  },
})
