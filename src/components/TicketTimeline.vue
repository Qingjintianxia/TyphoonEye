<template>
  <div class="tl-wrap">
    <div v-if="!items.length" class="tl-empty">暂无处置记录</div>
    <ol v-else class="tl-list">
      <li class="tl-item" v-for="item in items" :key="item.id">
        <span class="tl-dot" :class="{ 'tl-dot-comment': item.type === 'comment' }"></span>
        <div class="tl-body">
          <div class="tl-head">
            <span class="badge" :class="timelineMeta(item.type).badge">{{ timelineMeta(item.type).label }}</span>
            <span class="tl-operator">{{ item.operator || '系统' }}</span>
            <span class="tl-time">{{ formatDateTime(item.at) }}</span>
          </div>
          <div class="tl-content">
            <span v-if="item.type === 'status'" class="tl-transition">
              <span :class="`badge ${statusBadge(item.from)}`">{{ statusLabel(item.from) }}</span>
              <span class="tl-arrow">→</span>
              <span :class="`badge ${statusBadge(item.to)}`">{{ statusLabel(item.to) }}</span>
            </span>
            <span class="tl-text">{{ item.content || '—' }}</span>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { timelineMeta, statusLabel, statusBadge } from '../constants/ticket'
import { formatDateTime } from '../utils/format'

const props = defineProps({
  timeline: { type: Array, default: () => [] }
})

/** 时间正序展示 */
const items = computed(() =>
  [...props.timeline].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
)
</script>

<style scoped>
.tl-empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 8px 0;
}

.tl-list { list-style: none; position: relative; padding-left: 18px; }

.tl-list::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--border);
}

.tl-item { position: relative; padding-bottom: 16px; }
.tl-item:last-child { padding-bottom: 0; }

.tl-dot {
  position: absolute;
  left: -18px;
  top: 5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--blue);
  background: var(--bg-secondary);
}

.tl-dot-comment { border-color: var(--green); }

.tl-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tl-operator { font-size: 12px; color: var(--text-secondary); }
.tl-time { font-size: 11px; color: var(--text-muted); margin-left: auto; }

.tl-content { margin-top: 5px; font-size: 13px; color: var(--text-primary); }
.tl-transition { display: inline-flex; align-items: center; gap: 6px; margin-right: 8px; }
.tl-arrow { color: var(--text-muted); }
.tl-text { color: var(--text-secondary); }
</style>
