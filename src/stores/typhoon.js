import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http from '../utils/request'
import { TYPHOON_STATUS, compareLevel } from '../constants/typhoon'

export const useTyphoonStore = defineStore('typhoon', () => {
  const typhoons = ref([])
  const currentTyphoon = ref(null)
  const loading = ref(false)
  const error = ref('')
  const lastUpdatedAt = ref(null)

  const activeTyphoons = computed(() =>
    typhoons.value.filter((t) => t.status === TYPHOON_STATUS.ACTIVE)
  )
  const historicalTyphoons = computed(() =>
    typhoons.value.filter((t) => t.status === TYPHOON_STATUS.HISTORICAL)
  )

  /** 活跃台风按强度降序，用于监控页与仪表盘的优先级排序 */
  const activeTyphoonsByLevel = computed(() =>
    [...activeTyphoons.value].sort((a, b) => compareLevel(b.level, a.level))
  )

  /** 当前最需要关注的一个台风（强度最高） */
  const primaryTyphoon = computed(() => activeTyphoonsByLevel.value[0] || null)

  const typhoonById = computed(() => (id) => typhoons.value.find((t) => t.id === id) || null)

  async function fetchTyphoons(status = '') {
    loading.value = true
    error.value = ''
    try {
      const params = status ? { status } : undefined
      const list = await http.get('/typhoons', params)
      typhoons.value = Array.isArray(list) ? list : []
      lastUpdatedAt.value = Date.now()
      return typhoons.value
    } catch (e) {
      // 401 由请求层统一跳转，此处不展示通用错误文案
      if (!e?.isUnauthorized) error.value = e?.message || '台风数据加载失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchTyphoonById(id) {
    if (!id) {
      currentTyphoon.value = null
      return null
    }
    loading.value = true
    error.value = ''
    try {
      const data = await http.get(`/typhoons/${encodeURIComponent(id)}`)
      currentTyphoon.value = data || null
      return currentTyphoon.value
    } catch (e) {
      if (!e?.isUnauthorized) error.value = e?.message || '台风详情加载失败'
      currentTyphoon.value = null
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 离开详情页时调用，避免二次进入闪现旧数据 */
  function clearCurrent() {
    currentTyphoon.value = null
    error.value = ''
    loading.value = false
  }

  function reset() {
    typhoons.value = []
    clearCurrent()
    lastUpdatedAt.value = null
  }

  return {
    typhoons,
    currentTyphoon,
    loading,
    error,
    lastUpdatedAt,
    activeTyphoons,
    activeTyphoonsByLevel,
    primaryTyphoon,
    historicalTyphoons,
    typhoonById,
    fetchTyphoons,
    fetchTyphoonById,
    clearCurrent,
    reset
  }
})
