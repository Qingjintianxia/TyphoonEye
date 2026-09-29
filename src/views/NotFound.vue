<template>
  <div class="nf-page">
    <div class="nf-card glass-card">
      <div class="nf-code">404</div>
      <h1 class="nf-title">页面不存在</h1>
      <p class="nf-desc">
        你访问的路径 <code class="nf-path">{{ path }}</code> 没有对应的页面。
      </p>
      <div class="nf-actions">
        <router-link to="/" class="btn btn-primary">返回仪表盘</router-link>
        <button class="btn" type="button" @click="$router.back()">返回上一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const path = computed(() => route.fullPath)
</script>

<style scoped>
.nf-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: var(--bg-primary);
}

.nf-card {
  width: 100%;
  max-width: 460px;
  padding: 40px;
  text-align: center;
}

.nf-code {
  font-size: 56px;
  font-weight: 700;
  letter-spacing: -2px;
  color: var(--blue);
  line-height: 1;
  margin-bottom: 12px;
}

.nf-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 8px;
}

.nf-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.nf-path {
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  color: var(--text-primary);
  word-break: break-all;
}

.nf-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.nf-actions .btn {
  text-decoration: none;
}
</style>
