import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './'：产物可被任意静态目录（含 Capacitor WebView）直接加载，不锁死部署路径。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2020' },
})
