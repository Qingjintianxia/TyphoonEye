import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http, { ApiError } from '../utils/request'
import { WARNING_LEVELS } from '../constants/typhoon'

export const useAlertStore = defineStore('alert', () => {
  const alerts = ref([])
  /** 来源分项计数：{ manual, rule }。让用户知道"多少条是程序算出来的" */
  const breakdown = ref({ manual: 0, rule: 0 })
  const loading = ref(false)
  const error = ref('')
  const lastUpdatedAt = ref(null)

  /**
   * 按等级分组，一次性遍历完成（O(n)）。
   * 原实现在 AppLayout 中用 alerts.some() 嵌套过滤统计活跃台风预警，复杂度 O(n²)。
   */
  const groupedByLevel = computed(() => {
    const groups = {}
    WARNING_LEVELS.forEach((w) => { groups[w.key] = [] })
    alerts.value.forEach((a) => {
      if (groups[a.level]) groups[a.level].push(a)
    })
    return groups
  })

  const countByLevel = computed(() => {
    const counts = {}
    Object.entries(groupedByLevel.value).forEach(([k, list]) => { counts[k] = list.length })
    return counts
  })

  const redAlerts = computed(() => groupedByLevel.value.red)
  const orangeAlerts = computed(() => groupedByLevel.value.orange)
  const yellowAlerts = computed(() => groupedByLevel.value.yellow)
  const blueAlerts = computed(() => groupedByLevel.value.blue)

  /** 按来源分组：人工发布 / 规则派生 */
  const groupedBySource = computed(() => {
    const groups = { manual: [], rule: [] }
    alerts.value.forEach((a) => {
      if (groups[a.source]) groups[a.source].push(a)
      else groups.rule.push(a) // 未知来源归入派生，避免"看起来像人工研判"
    })
    return groups
  })

  /** 按台风 ID 分组，供详情页直接复用而不必再请求一次 */
  const byTyphoonId = computed(() => (id) => alerts.value.filter((a) => a.typhoonId === id))

  /** 与活跃台风关联的预警数量（侧边栏角标） */
  function countForActiveTyphoons(activeIds) {
    const idSet = activeIds instanceof Set ? activeIds : new Set(activeIds || [])
    return alerts.value.reduce((n, a) => (a.typhoonId && idSet.has(a.typhoonId) ? n + 1 : n), 0)
  }

  /**
   * 列表接口除 data 外还返回 breakdown（人工/规则分项），
   * 这里用 raw 拿完整响应体自行解包，保留 breakdown 字段。
   */
  async function fetchAlerts(level = '', extraParams = {}) {
    loading.value = true
    error.value = ''
    try {
      const params = { ...extraParams }
      if (level) params.level = level
      const res = await http.get('/alerts', Object.keys(params).length ? params : undefined, { raw: true })
      if (res?.code !== undefined && res.code !== 200) {
        throw new ApiError(res.message || '预警数据加载失败', { code: res.code, status: res.code })
      }
      alerts.value = Array.isArray(res?.data) ? res.data : []
      breakdown.value = res?.breakdown || { manual: 0, rule: 0 }
      lastUpdatedAt.value = Date.now()
      return alerts.value
    } catch (e) {
      if (!e?.isUnauthorized) error.value = e?.message || '预警数据加载失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 预警推送：assignee 为空表示全体广播。
   * 后端业务失败返回 code:400 而非 HTTP 400，raw 解包后自行判定。
   */
  async function dispatch(alertIds, assignee = '') {
    if (!Array.isArray(alertIds) || !alertIds.length) throw new Error('请选择要推送的预警')
    const res = await http.post('/alerts/dispatch', { alertIds, assignee }, { raw: true })
    if (res?.code !== undefined && res.code !== 200) {
      throw new ApiError(res.message || '推送失败', { code: res.code, status: res.code })
    }
    return res?.data || { sent: 0, total: 0 }
  }

  function reset() {
    alerts.value = []
    breakdown.value = { manual: 0, rule: 0 }
    error.value = ''
    lastUpdatedAt.value = null
  }

  return {
    alerts,
    breakdown,
    loading,
    error,
    lastUpdatedAt,
    redAlerts,
    orangeAlerts,
    yellowAlerts,
    blueAlerts,
    groupedByLevel,
    groupedBySource,
    byTyphoonId,
    countByLevel,
    countForActiveTyphoons,
    fetchAlerts,
    dispatch,
    reset
  }
})
