import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 关键修复：使用相对路径，防止 Android WebView 找不到资源导致白屏
  base: './', 
  build: {
    outDir: 'dist',
    // 确保资源被正确打包
    assetsDir: 'assets',
    // 建议开启，方便在 Chrome Inspect 中调试错误
    sourcemap: true 
  }
})
