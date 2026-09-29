/**
 * 工单 store
 *
 * 约定：
 * - 列表的筛选条件由调用方传入并保存在 filters 中，页面直接双向绑定即可。
 * - 写操作（建单 / 流转 / 意见）成功后原地替换数组项，不整列表重拉，避免闪烁。
 * - 状态机校验只在后端做最终裁决；前端 nextStatuses() 只负责按钮渲染。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http from '../utils/request'
import { TICKET_STATUS } from '../constants/ticket'

export const useTicketStore = defineStore('ticket', () => {
  const tickets = ref([])
  const stats = ref(null)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref('')
  const filters = ref({ status: '', level: '', assignee: '', typhoonId: '' })
  const lastUpdatedAt = ref(null)

  /** 未闭环工单：工单中心默认关注对象 */
  const openTickets = computed(() =>
    tickets.value.filter((t) => t.status !== TICKET_STATUS.CLOSED)
  )
  const closedTickets = computed(() =>
    tickets.value.filter((t) => t.status === TICKET_STATUS.CLOSED)
  )

  /**
   * 按预警 ID 查找未闭环工单。
   * 预警卡片据此把按钮切换为"查看工单"，从源头避免重复建单报错。
   */
  const openTicketByAlertId = computed(() => (alertId) =>
    tickets.value.find((t) => t.alertId === alertId && t.status !== TICKET_STATUS.CLOSED) || null
  )

  /** 已建单的预警 ID 集合，供列表批量渲染时 O(1) 判断 */
  const ticketedAlertIds = computed(
    () => new Set(tickets.value.filter((t) => t.status !== TICKET_STATUS.CLOSED).map((t) => t.alertId))
  )

  function buildParams() {
    const p = {}
    Object.entries(filters.value).forEach(([k, v]) => {
      if (v) p[k] = v
    })
    return Object.keys(p).length ? p : undefined
  }

  async function fetchTickets(nextFilters) {
    if (nextFilters) filters.value = { ...filters.value, ...nextFilters }
    loading.value = true
    error.value = ''
    try {
      const list = await http.get('/tickets', buildParams())
      tickets.value = Array.isArray(list) ? list : []
      lastUpdatedAt.value = Date.now()
      return tickets.value
    } catch (e) {
      if (!e?.isUnauthorized) error.value = e?.message || '工单加载失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    try {
      stats.value = await http.get('/tickets/stats')
      return stats.value
    } catch (e) {
      // 统计失败不阻塞页面，降级为 null
      stats.value = null
      throw e
    }
  }

  /** 建单：成功后把新工单插入列表头部（保持与后端一致的排序语义） */
  async function createTicket(payload) {
    submitting.value = true
    try {
      const created = await http.post('/tickets', payload)
      tickets.value = [created, ...tickets.value]
      await fetchStats()
      return created
    } finally {
      submitting.value = false
    }
  }

  async function changeStatus(id, status, note = '') {
    submitting.value = true
    try {
      const updated = await http.patch(`/tickets/${id}/status`, { status, note })
      replaceTicket(updated)
      await fetchStats()
      return updated
    } finally {
      submitting.value = false
    }
  }

  async function addComment(id, content) {
    submitting.value = true
    try {
      const updated = await http.post(`/tickets/${id}/comments`, { content })
      replaceTicket(updated)
      return updated
    } finally {
      submitting.value = false
    }
  }

  function replaceTicket(next) {
    if (!next || !next.id) return
    const idx = tickets.value.findIndex((t) => t.id === next.id)
    if (idx === -1) tickets.value = [next, ...tickets.value]
    else tickets.value.splice(idx, 1, next)
  }

  function setFilter(key, value) {
    filters.value = { ...filters.value, [key]: value }
  }

  function resetFilters() {
    filters.value = { status: '', level: '', assignee: '', typhoonId: '' }
  }

  function reset() {
    tickets.value = []
    stats.value = null
    error.value = ''
    lastUpdatedAt.value = null
    resetFilters()
  }

  return {
    tickets,
    stats,
    loading,
    submitting,
    error,
    filters,
    lastUpdatedAt,
    openTickets,
    closedTickets,
    openTicketByAlertId,
    ticketedAlertIds,
    fetchTickets,
    fetchStats,
    createTicket,
    changeStatus,
    addComment,
    setFilter,
    resetFilters,
    reset
  }
})
