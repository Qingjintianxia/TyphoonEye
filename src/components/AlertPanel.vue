<template>
  <div class="glass-card" style="padding: 20px;">
    <div class="section-header">
      <span class="section-title">{{ title }}</span>
      <router-link to="/alerts" class="btn" v-if="showMore">查看全部 →</router-link>
    </div>

    <div class="alert-list" v-if="alerts.length">
      <div
        class="alert-item warn-bar fade-in"
        v-for="(a, i) in alerts"
        :key="a.id"
        :class="[`warn-${a.level}`, `fade-in-${Math.min(i + 1, 4)}`]"
      >
        <div class="alert-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="alert-content">
          <div class="alert-header">
            <span class="warn-tag is-lg" :class="`warn-${a.level}`">{{ warningLabel(a.level) }}</span>
            <span class="alert-title">{{ a.title }}</span>
          </div>
          <p class="alert-desc">{{ a.content }}</p>
          <div class="alert-meta">
            <span>{{ a.city }}</span>
            <span class="dot">·</span>
            <span :title="formatDateTime(a.publishTime)">{{ relativeTime(a.publishTime) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">暂无预警信息</div>
  </div>
</template>

<script setup>
import { warningLabel } from '../constants/typhoon'
import { relativeTime, formatDateTime } from '../utils/format'

defineProps({
  title: { type: String, default: '最新预警' },
  alerts: { type: Array, default: () => [] },
  showMore: { type: Boolean, default: true }
})
</script>

<style scoped>
.alert-item {
  display: flex;
  gap: 14px;
  padding: 16px;
  border-radius: var(--radius-sm);
  border-left: 3px solid transparent;
  margin-bottom: 8px;
  background: rgba(255,255,255,0.01);
  transition: all var(--transition);
}

.alert-item:hover { background: rgba(255,255,255,0.03); }

.alert-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.alert-item.warn-blue .alert-icon { color: var(--blue); }
.alert-item.warn-yellow .alert-icon { color: var(--yellow); }
.alert-item.warn-orange .alert-icon { color: var(--orange); }
.alert-item.warn-red .alert-icon { color: var(--red); }

.alert-content { flex: 1; min-width: 0; }
.alert-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.alert-title { font-weight: 600; font-size: 14px; }
.alert-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px; }
.alert-meta { font-size: 12px; color: var(--text-muted); }
.dot { margin: 0 4px; }

.empty-state { text-align: center; padding: 40px; color: var(--text-muted); }
</style>
