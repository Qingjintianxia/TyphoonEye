import { computed, ref, toValue } from 'vue'
import { SORT_OPTIONS, LEVEL_META, defaultSortOrder } from '../constants/typhoon'
import { parseTime } from '../utils/format'

/**
 * 台风列表筛选 / 排序的单一来源。
 *
 * 设计要点：
 * 1. 视图只负责渲染控件与绑定条件，不得自行写 filter / sort —— 前序评审已吃过
 * "同一份逻辑散落 3–4 处"的亏。
 * 2. filterTyphoons 是纯函数，便于单测与在非组件环境复用。
 * 3. 空值一律按"缺失"处理并恒排末尾，绝不产生 NaN 破坏排序稳定性。
 */

/** 默认筛选条件。每次调用返回新对象，避免多个消费者共享同一引用 */
export function createDefaultQuery() {
  return {
    keyword: '',
    levels: [],
    warnings: [],
    status: 'all',
    sortBy: 'level',
    sortOrder: defaultSortOrder('level')
  }
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

/** 取某字段用于排序的可比较数值；缺失返回 null */
function sortValue(t, key) {
  if (!t) return null
  switch (key) {
    case 'level':
      return LEVEL_META[t.level]?.rank ?? null
    case 'windSpeed':
      return toNumber(t.windSpeed)
    case 'pressure':
      return toNumber(t.pressure)
    case 'updateTime': {
      const d = parseTime(t.updateTime)
      return d ? d.getTime() : null
    }
    default:
      return null
  }
}

/**
 * 纯函数：按条件过滤并排序。
 * @param {Array} list 源数据
 * @param {Object} query 筛选条件
 * @returns {Array} 新数组，不修改入参
 */
export function filterTyphoons(list, query) {
  const src = Array.isArray(list) ? list : []
  const q = query || {}

  const keyword = String(q.keyword || '').trim().toLowerCase()
  const levels = Array.isArray(q.levels) ? q.levels : []
  const warnings = Array.isArray(q.warnings) ? q.warnings : []
  const status = q.status || 'all'

  const matched = src.filter((t) => {
    if (!t) return false
    if (status !== 'all' && t.status !== status) return false
    if (levels.length && !levels.includes(t.level)) return false
    if (warnings.length && !warnings.includes(t.warningLevel)) return false
    if (keyword) {
      const haystack = [t.name, t.nameEn, t.id].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })

  const key = q.sortBy || 'level'
  const dir = q.sortOrder === 'asc' ? 1 : -1

  return matched.sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    // 缺失值恒排末尾：升序时也不应让"无数据"抢占前排造成误导
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    if (va === vb) return 0
    return (va - vb) * dir
  })
}

/** 是否处于筛选态（排序不算筛选，不触发"清除筛选"） */
export function isFiltered(query) {
  const q = query || {}
  return !!(
    String(q.keyword || '').trim() ||
    (Array.isArray(q.levels) && q.levels.length) ||
    (Array.isArray(q.warnings) && q.warnings.length) ||
    (q.status && q.status !== 'all')
  )
}

/**
 * 响应式封装：接收源数组（ref / getter / 普通数组），返回筛选结果与操作函数。
 * query 为 ref，配合子组件 v-model:query 使用。
 *
 * @param {Ref|Function|Array} source 源数据，支持 getter 以便跟随 store 变化
 * @param {Object} initial 页面级初始条件（如监控页默认只看活跃台风）
 */
export function useTyphoonFilter(source, initial = {}) {
  const query = ref({ ...createDefaultQuery(), ...initial })

  const result = computed(() => filterTyphoons(toValue(source), query.value))
  const filtered = computed(() => isFiltered(query.value))

  function patch(partial) {
    query.value = { ...query.value, ...partial }
  }

  function reset() {
    // 保留当前排序，仅清除筛选条件
    query.value = { ...createDefaultQuery(), sortBy: query.value.sortBy, sortOrder: query.value.sortOrder }
  }

  /** 点击表头/下拉：同字段则切换升降序，换字段则用该字段的业务默认方向 */
  function setSort(key) {
    if (query.value.sortBy === key) {
      patch({ sortOrder: query.value.sortOrder === 'asc' ? 'desc' : 'asc' })
    } else {
      patch({ sortBy: key, sortOrder: defaultSortOrder(key) })
    }
  }

  function toggleInArray(field, value) {
    const current = Array.isArray(query.value[field]) ? query.value[field] : []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    patch({ [field]: next })
  }

  function toggleLevel(level) {
    toggleInArray('levels', level)
  }

  function toggleWarning(level) {
    toggleInArray('warnings', level)
  }

  return {
    query,
    result,
    filtered,
    patch,
    reset,
    setSort,
    toggleLevel,
    toggleWarning,
    sortOptions: SORT_OPTIONS
  }
}
