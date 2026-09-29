<template>
  <div class="bell-wrap" ref="wrapRef">
    <button class="bell-btn" @click="toggle" :aria-label="`消息中心，${unread} 条未读`">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span class="bell-badge" v-if="unread > 0">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <div class="bell-panel" v-if="open">
      <div class="bp-head">
        <span class="bp-title">消息中心</span>
        <button class="bp-readall" @click="readAll" :disabled="!unread">全部已读</button>
      </div>

      <div class="bp-body">
        <div v-if="store.loading && !list.length" class="bp-empty">加载中...</div>
        <div v-else-if="!list.length" class="bp-empty">暂无消息</div>
        <template v-else>
          <div
            class="bp-item"
            v-for="n in list"
            :key="n.id"
            :class="{ 'bp-unread': !n.read }"
            @click="openItem(n)"
          >
            <div class="bp-item-head">
              <span class="badge" :class="notifyTypeMeta(n.type).badge">{{ notifyTypeMeta(n.type).label }}</span>
              <span class="bp-time">{{ formatDateTime(n.createdAt) }}</span>
            </div>
            <div class="bp-item-title">{{ n.title }}</div>
            <div class="bp-item-content">{{ n.content }}</div>
          </div>
        </template>
      </div>

      <router-link to="/messages" class="bp-foot" @click="open = false">查看全部消息 →</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '../stores/notification'
import { notifyTypeMeta } from '../constants/ticket'
import { formatDateTime } from '../utils/format'
import { toast } from '../utils/toast'

const store = useNotificationStore()
const router = useRouter()
const open = ref(false)
const wrapRef = ref(null)

const unread = computed(() => store.unread)
/** 下拉只展示最近 5 条，完整列表在消息中心页 */
const list = computed(() => store.notifications.slice(0, 5))

function handleOutside(e) {
  if (wrapRef.value && !wrapRef.value.contains(e.target)) open.value = false
}

async function toggle() {
  open.value = !open.value
  // 首次展开才拉列表：未读数靠轮询维护，不必每次点都请求
  if (open.value && !store.notifications.length) {
    try { await store.fetchNotifications() } catch { /* 错误已在 store 记录 */ }
  }
}

async function readAll() {
  const n = await store.markAllRead()
  toast.success(n ? `已将 ${n} 条标记为已读` : '没有未读消息')
}

async function openItem(item) {
  if (!item.read) await store.markRead(item.id)
  open.value = false
  if (item.refType === 'ticket') router.push('/tickets')
  else if (item.refType === 'alert') router.push('/alerts')
  else router.push('/messages')
}

onMounted(() => {
  document.addEventListener('click', handleOutside)
  // 进入应用时先取一次未读，不必等第一个轮询周期
  store.fetchUnreadCount().catch(() => {})
})

onUnmounted(() => document.removeEventListener('click', handleOutside))
</script>

<style scoped>
.bell-wrap { position: relative; }

.bell-btn {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
}

.bell-btn:hover { color: var(--text-primary); background: rgba(255, 255, 255, 0.1); }

.bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--red);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
}

.bell-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 340px;
  max-height: 420px;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  overflow: hidden;
}

.bp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.bp-title { font-size: 14px; font-weight: 600; }

.bp-readall {
  border: none;
  background: none;
  color: var(--blue);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.bp-readall:disabled { color: var(--text-muted); cursor: default; }

.bp-body { overflow-y: auto; padding: 6px 0; }

.bp-empty { padding: 28px 0; text-align: center; font-size: 13px; color: var(--text-muted); }

.bp-item {
  padding: 10px 16px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background var(--transition);
}
.bp-item:hover { background: rgba(255, 255, 255, 0.03); }
.bp-unread { border-left-color: var(--blue); background: rgba(59, 130, 246, 0.05); }

.bp-item-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.bp-time { font-size: 11px; color: var(--text-muted); }
.bp-item-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
.bp-item-content {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.bp-foot {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--blue);
  text-decoration: none;
  text-align: center;
}
.bp-foot:hover { background: rgba(255, 255, 255, 0.03); }
</style>
