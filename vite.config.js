import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 相对基址：可部署到任意子目录，也可直接双击 dist/index.html 之外的静态服务器
  base: './',
  plugins: [vue()],
})
