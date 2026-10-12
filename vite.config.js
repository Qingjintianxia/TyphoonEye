import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    // echarts 按需引入后仍是 ~520 kB 的独立 vendor chunk（仅访问仪表盘/历史页时按需加载，
    // 不进首屏）。这是已知且已接受的体积，阈值调至 600 以免每次构建都报无意义告警。
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // 第三方大依赖拆成独立 chunk：
        // 1) echarts / leaflet 体积大且很少变动，拆出后业务代码改动不会让用户重新下载它们；
        // 2) 它们可被多个路由共享。
        manualChunks(id) {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'echarts'
          }
          if (id.includes('node_modules/leaflet')) return 'leaflet'
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) return 'vue'
          return null
        }
      }
    }
  }
})
