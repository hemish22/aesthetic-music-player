import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Spotify only allows loopback redirects on 127.0.0.1 (not "localhost"), so bind there.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
})
