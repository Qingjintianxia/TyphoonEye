/**
 * 消息中心 store
 *
 * 未读数采用轻量轮询（默认 60s），原因：用户已明确不做 WebSocket 实时化。
 * 三条节流约束：
 * 页面不可见（document.hidden）时跳过轮询。
 * 上一轮未结束不发起下一轮。
 * 轮询失败不弹 toast。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http from '../utils/request'

const DEFAULT_INTERVAL = 60000

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref([])
  const unread = ref(0)
  const loading = ref(false)
  const error = ref('')

  let timer = null
  let inFlight = false

  const unreadList = computed(() => notifications.value.filter((n) => !n.read))
  const hasUnread = computed(() => unread.value > 0)

  async function fetchNotifications() {
    loading.value = true
    error.value = ''
    try {
      const data = await http.get('/notifications')
      notifications.value = Array.isArray(data) ? data : []
      // 以服务端返回的未读数为准：列表可能只取了本人+广播，服务端口径最权威
      await fetchUnreadCount()
      return notifications.value
    } catch (e) {
      if (!e?.isUnauthorized) error.value = e?.message || '消息加载失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchUnreadCount(options = {}) {
    const { silent = true } = options
    try {
      const data = await http.get('/notifications/unread-count', undefined, { silent })
      unread.value = Number(data?.unread) || 0
      return unread.value
    } catch (e) {
      if (!silent && !e?.isUnauthorized) error.value = e?.message || '未读数加载失败'
      throw e
    }
  }

  /** 单条已读：成功后同步递减本地未读数 */
  async function markRead(id) {
    try {
      await http.patch(`/notifications/${id}/read`)
      const item = notifications.value.find((n) => n.id === id)
      if (item && !item.read) {
        item.read = true
        unread.value = Math.max(0, unread.value - 1)
      }
      return true
    } catch {
      return false
    }
  }

  async function markAllRead() {
    try {
      const data = await http.post('/notifications/read-all')
      notifications.value.forEach((n) => { n.read = true })
      unread.value = 0
      return Number(data?.updated) || 0
    } catch {
      return 0
    }
  }

  function startPolling(interval = DEFAULT_INTERVAL) {
    stopPolling()
    timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (inFlight) return
      inFlight = true
      fetchUnreadCount()
        .catch(() => { /* 静默：角标失败不打扰用户 */ })
        .finally(() => { inFlight = false })
    }, interval)
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function reset() {
    stopPolling()
    notifications.value = []
    unread.value = 0
    error.value = ''
    inFlight = false
  }

  return {
    notifications,
    unread,
    loading,
    error,
    unreadList,
    hasUnread,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    startPolling,
    stopPolling,
    reset
  }
})
