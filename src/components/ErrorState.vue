<template>
  <div class="error-state" role="alert">
    <div class="es-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
      </svg>
    </div>
    <p class="es-title">{{ title }}</p>
    <p class="es-desc" v-if="description">{{ description }}</p>
    <button v-if="retryable" class="btn es-btn" type="button" @click="$emit('retry')" :disabled="loading">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
      {{ loading ? '重试中...' : '重新加载' }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '数据加载失败' },
  description: { type: String, default: '' },
  retryable: { type: Boolean, default: true },
  loading: { type: Boolean, default: false }
})
defineEmits(['retry'])
</script>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
}

.es-icon {
  color: var(--red);
  opacity: 0.85;
}

.es-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.es-desc {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 420px;
  line-height: 1.6;
}

.es-btn {
  margin-top: 6px;
}
</style>
