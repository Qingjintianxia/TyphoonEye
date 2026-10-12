<template>
  <div>
    <div class="mc-head">
      <div>
        <h1 class="page-title">消息中心</h1>
        <p class="page-subtitle">
          工单动态与预警推送
          <span v-if="store.unread > 0" class="mc-unread">· {{ store.unread }} 条未读</span>
        </p>
      </div>
      <div class="mc-actions">
        <button class="btn" @click="refresh" :disabled="store.loading">
          {{ store.loading ? '刷新中...' : '刷新' }}
        </button>
        <button class="btn btn-primary" @click="readAll" :disabled="!store.unread">全部已读</button>
      </div>
    </div>

    <div v-if="store.error" class="state-wrap">
      <ErrorState title="消息加载失败" :description="store.error" @retry="refresh" />
    </div>

    <template v-else>
      <div class="filter-tabs" style="margin-bottom: 20px;">
        <button
          class="filter-tab"
          v-for="f in FILTERS"
          :key="f.key"
          :class="{ active: activeFilter === f.key }"
          @click="activeFilter = f.key"
        >{{ f.label }} ({{ countOf(f.key) }})</button>
      </div>

      <div v-if="store.loading && !store.notifications.length" class="empty-state" style="padding: 60px;">
        加载中...
      </div>

      <div v-else-if="!filtered.length" class="empty-state" style="padding: 60px;">
        暂无消息
      </div>

      <div class="mc-list" v-else>
        <div
          class="mc-item glass-card"
          v-for="n in filtered"
          :key="n.id"
          :class="{ 'mc-unread-item': !n.read }"
          role="button" tabindex="0"
          @click="openItem(n)"
          @keydown.enter.prevent="openItem(n)"
        >
          <div class="mci-head">
            <span class="mci-dot" v-if="!n.read"></span>
            <span class="badge" :class="notifyTypeMeta(n.type).badge">{{ notifyTypeMeta(n.type).label }}</span>
            <span class="warn-tag" :class="`warn-${n.level || 'blue'}`">{{ warningLabel(n.level) }}</span>
            <span class="mci-title">{{ n.title }}</span>
            <span class="mci-time">{{ formatDateTime(n.createdAt) }}</span>
          </div>
          <div class="mci-content">{{ n.content }}</div>
          <div class="mci-foot">
            <span>来自 {{ n.actor || '系统' }}</span>
            <span v-if="n.userId === null" class="mci-broadcast">全体广播</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
import { notifyTypeMeta } from '../constants/ticket'
import { warningLabel } from '../constants/typhoon'
import { formatDateTime } from '../utils/format'
import { toast } from '../utils/toast'
import ErrorState from '../components/ErrorState.vue'

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'read', label: '已读' }
]

const store = useNotificationStore()
const router = useRouter()
const activeFilter = ref('all')

const filtered = computed(() => {
  if (activeFilter.value === 'unread') return store.notifications.filter((n) => !n.read)
  if (activeFilter.value === 'read') return store.notifications.filter((n) => n.read)
  return store.notifications
})

function countOf(key) {
  if (key === 'unread') return store.notifications.filter((n) => !n.read).length
  if (key === 'read') return store.notifications.filter((n) => n.read).length
  return store.notifications.length
}

async function refresh() {
  try { await store.fetchNotifications() } catch { /* store 已记录错误 */ }
}

async function readAll() {
  const n = await store.markAllRead()
  toast.success(n ? `已将 ${n} 条标记为已读` : '没有未读消息')
}

async function openItem(item) {
  if (!item.read) await store.markRead(item.id)
  if (item.refType === 'ticket') router.push('/tickets')
  else if (item.refType === 'alert') router.push('/alerts')
}

onMounted(() => {
  // 进入页面即拉一次列表
  refresh()
})
</script>

<style scoped>
.mc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.mc-unread { color: #f87171; }

.mc-actions { display: flex; gap: 10px; }

.mc-list { display: flex; flex-direction: column; gap: 10px; }

.mc-item {
  padding: 14px 18px;
  cursor: pointer;
  border-left: 3px solid transparent;
  outline: none;
}

.mc-unread-item { border-left-color: var(--blue); background: rgba(59, 130, 246, 0.06); }

.mci-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.mci-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--blue);
  box-shadow: 0 0 8px var(--blue-glow);
}

.mci-title { font-size: 14px; font-weight: 600; }
.mci-time { margin-left: auto; font-size: 11px; color: var(--text-muted); }

.mci-content {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
  line-height: 1.6;
}

.mci-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.mci-broadcast {
  padding: 1px 7px;
  border-radius: 10px;
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.empty-state, .state-wrap {
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
