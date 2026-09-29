<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2a10 10 0 0 1 0 20"/>
            <path d="M12 2a10 10 0 0 0 0 20"/>
            <path d="M2 12h20"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-title">TyphoonEye</span>
          <span class="brand-subtitle">台风预警系统</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" exact-active-class="active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>仪表盘</span>
        </router-link>
        <router-link to="/monitor" class="nav-item" active-class="active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span>台风监控</span>
        </router-link>
        <router-link to="/alerts" class="nav-item" active-class="active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span>预警中心</span>
          <span class="nav-badge" v-if="alertCount > 0">{{ alertCount }}</span>
        </router-link>
        <router-link to="/tickets" class="nav-item" active-class="active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 3h6a2 2 0 0 1 2 2v1H7V5a2 2 0 0 1 2-2z"/>
            <path d="M7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
            <path d="M9 12h6"/><path d="M9 16h4"/>
          </svg>
          <span>处置工单</span>
          <span class="nav-badge" v-if="openTicketCount > 0">{{ openTicketCount }}</span>
        </router-link>
        <router-link to="/history" class="nav-item" active-class="active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>历史数据</span>
        </router-link>
        <router-link to="/compare" class="nav-item" active-class="active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 17l5-6 4 4 5-8 4 5"/>
          </svg>
          <span>路径对比</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="status-indicator">
          <span class="pulse-dot"></span>
          <span>系统运行中</span>
        </div>
        <div class="status-time">{{ currentTime }}</div>
      </div>
    </aside>

    <main class="main-content">
      <header class="top-bar">
        <div class="top-bar-left">
          <span class="top-bar-title">{{ pageTitle }}</span>
        </div>
        <div class="top-bar-right">
          <div class="weather-brief" v-if="activeCount > 0">
            <span class="alert-dot red"></span>
            {{ activeCount }} 个台风活跃中
          </div>
          <!-- 消息铃铛：未读数由 store 轮询维护，角标不参与侧栏 alertCount 口径 -->
          <NotificationBell />
          <div class="user-menu" ref="menuRef">
            <div class="user-avatar" @click="showMenu = !showMenu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <span class="user-name" @click="showMenu = !showMenu">{{ authStore.user?.username || '用户' }}</span>
            <div class="user-dropdown" v-if="showMenu" @click.outside="showMenu = false">
              <div class="dropdown-header">
                <span class="dropdown-username">{{ authStore.user?.username }}</span>
                <span class="dropdown-email">{{ authStore.user?.email || '未设置邮箱' }}</span>
              </div>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item logout-btn" @click="handleLogout">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>
      <div class="page-content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTyphoonStore } from '../stores/typhoon'
import { useAlertStore } from '../stores/alert'
import { useAuthStore } from '../stores/auth'
import { useTicketStore } from '../stores/ticket'
import { useNotificationStore } from '../stores/notification'
import { isTokenValid } from '../utils/token'
import NotificationBell from './NotificationBell.vue'

const route = useRoute()
const router = useRouter()
const typhoonStore = useTyphoonStore()
const alertStore = useAlertStore()
const authStore = useAuthStore()
const ticketStore = useTicketStore()
const notificationStore = useNotificationStore()

const showMenu = ref(false)
const menuRef = ref(null)

function handleClickOutside(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    showMenu.value = false
  }
}

function handleLogout() {
  authStore.logout()
  showMenu.value = false
  router.push('/login')
}

const pageTitle = computed(() => route.meta?.title || '')
const activeCount = computed(() => typhoonStore.activeTyphoons.length)
// 用 store 的 O(n) 辅助函数替代嵌套 .some() 的 O(n²) 计算
const alertCount = computed(() =>
  alertStore.countForActiveTyphoons(
    new Set(typhoonStore.activeTyphoons.map(t => t.id))
  )
)
const authReady = computed(() => !!authStore.user)

/** 未闭环工单数：只取统计接口，不拉全量列表，避免布局层产生不必要的数据加载 */
const openTicketCount = computed(() => {
  const s = ticketStore.stats
  if (!s?.byStatus) return 0
  return (s.byStatus.pending || 0) + (s.byStatus.processing || 0)
})

const currentTime = ref('')
let timer

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
  document.addEventListener('click', handleClickOutside)

  // 兜底：布局层只应在已登录态下发数据请求。
  // 无有效 token 时静默跳过（时钟与事件监听照常初始化），
  // 避免抢跑请求打出 401 并触发"登录已过期"误报。
  if (!isTokenValid()) return

  authStore.fetchMe()
  typhoonStore.fetchTyphoons()
  alertStore.fetchAlerts()
  // 工单统计失败不影响主流程（角标降级为不显示）
  ticketStore.fetchStats().catch(() => {})
  // 未读数轮询：页面隐藏时自动跳过，卸载时停止
  notificationStore.startPolling()
})

onUnmounted(() => {
  clearInterval(timer)
  document.removeEventListener('click', handleClickOutside)
  notificationStore.stopPolling()
})
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  width: 240px;
  min-width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 0 16px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 8px 20px;
  border-bottom: 1px solid var(--border);
}

.brand-icon {
  color: var(--blue);
  display: flex;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.brand-subtitle {
  font-size: 11px;
  color: var(--text-muted);
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all var(--transition);
  position: relative;
}

.nav-item:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.04);
}

.nav-item.active {
  color: var(--text-primary);
  background: rgba(59,130,246,0.12);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--blue);
  border-radius: 0 2px 2px 0;
}

.nav-badge {
  margin-left: auto;
  background: var(--red);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.sidebar-footer {
  border-top: 1px solid var(--border);
  padding: 16px 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.status-time {
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'Courier New', monospace;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32px;
  height: 60px;
  min-height: 60px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.top-bar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.weather-brief {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.alert-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.alert-dot.red { background: var(--red); box-shadow: 0 0 8px var(--red-glow); animation: pulse 2s infinite; }

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--transition);
}

.user-avatar:hover {
  background: rgba(255,255,255,0.12);
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.user-name {
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 200px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.dropdown-header {
  padding: 12px 16px;
}

.dropdown-username {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.dropdown-email {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--transition);
}

.dropdown-item:hover {
  background: rgba(255,255,255,0.04);
  color: var(--text-primary);
}

.logout-btn:hover {
  color: var(--red);
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
}
</style>
