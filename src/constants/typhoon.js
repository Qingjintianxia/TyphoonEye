/**
 * 台风与预警领域的唯一常量来源（Single Source of Truth）
 *
 * 设计要点：
 * 1. 预警信号色（蓝/黄/橙/红）与台风强度色是两套独立语义，不可混用。
 * 预警四色对应国内气象预警标准，是用户需要条件反射识别的色系。
 * 2. 均以有序数组定义，保证图例渲染顺序与强度比较顺序一致。
 * 3. 组件只消费派生的 META 查表对象，不得再自行定义颜色或文案。
 */

/** 气象预警等级（四色标准），按严重程度递增 */
export const WARNING_LEVELS = [
  { key: 'blue', label: '蓝色预警', short: '蓝色', color: '#3b82f6', cssVar: '--blue' },
  { key: 'yellow', label: '黄色预警', short: '黄色', color: '#f59e0b', cssVar: '--yellow' },
  { key: 'orange', label: '橙色预警', short: '橙色', color: '#f97316', cssVar: '--orange' },
  { key: 'red', label: '红色预警', short: '红色', color: '#ef4444', cssVar: '--red' }
]

/** 台风强度等级，按强度递增。使用连续低饱和色阶，与预警四色区分 */
export const TYPHOON_LEVELS = [
  { key: '热带低压', color: '#10b981', badge: 'badge-green', rank: 1 },
  { key: '热带风暴', color: '#3b82f6', badge: 'badge-blue', rank: 2 },
  { key: '强热带风暴', color: '#f59e0b', badge: 'badge-yellow', rank: 3 },
  { key: '台风', color: '#f97316', badge: 'badge-orange', rank: 4 },
  { key: '强台风', color: '#ef4444', badge: 'badge-orange', rank: 5 },
  { key: '超强台风', color: '#8b5cf6', badge: 'badge-red', rank: 6 }
]

/** 台风状态 */
export const TYPHOON_STATUS = {
  ACTIVE: 'active',
  HISTORICAL: 'historical'
}

export const STATUS_META = {
  active: { label: '活跃中', badge: 'badge-red' },
  historical: { label: '已结束', badge: 'badge-green' }
}

/** 风圈等级，按半径由大到小排序 */
export const WIND_RINGS = [
  { key: 'radius7', label: '7级风圈', color: '#3b82f6', rank: 1 },
  { key: 'radius10', label: '10级风圈', color: '#f59e0b', rank: 2 },
  { key: 'radius12', label: '12级风圈', color: '#ef4444', rank: 3 }
]

/** 预警等级 → 元信息 查表 */
export const WARNING_META = WARNING_LEVELS.reduce((acc, item) => {
  acc[item.key] = item
  return acc
}, {})

/** 强度等级 → 元信息 查表 */
export const LEVEL_META = TYPHOON_LEVELS.reduce((acc, item) => {
  acc[item.key] = item
  return acc
}, {})

/** 强度等级 → badge 类名，未知等级降级为蓝色 */
export function levelBadgeClass(level) {
  return LEVEL_META[level]?.badge || 'badge-blue'
}

/** 强度等级 → 色值，未知等级降级为蓝色 */
export function levelColor(level) {
  return LEVEL_META[level]?.color || '#3b82f6'
}

/** 预警等级 → 完整文案，未知等级原样返回 */
export function warningLabel(level) {
  return WARNING_META[level]?.label || level || '未定级'
}

/** 预警等级 → 简短文案 */
export function warningShort(level) {
  return WARNING_META[level]?.short || level || '—'
}

/** 预警等级 → 色值 */
export function warningColor(level) {
  return WARNING_META[level]?.color || '#3b82f6'
}

/** 状态 → 元信息 */
export function statusMeta(status) {
  return STATUS_META[status] || { label: status || '未知', badge: 'badge-blue' }
}

/** 比较两个强度等级，返回 -1 / 0 / 1，用于排序 */
export function compareLevel(a, b) {
  const ra = LEVEL_META[a]?.rank ?? 0
  const rb = LEVEL_META[b]?.rank ?? 0
  return ra === rb ? 0 : ra > rb ? 1 : -1
}

/**
 * 列表可排序字段。
 *
 * defaultOrder 表示"业务上更有意义的默认方向"：气压越低台风越强，
 * 故其默认方向为 asc（低压在前）。UI 标签必须把方向写出来（如"中心气压（低→高）"），
 * 避免出现"按气压排序"这种语义歧义。
 */
export const SORT_OPTIONS = [
  { key: 'level', label: '强度等级（强→弱）', defaultOrder: 'desc' },
  { key: 'windSpeed', label: '最大风速（高→低）', defaultOrder: 'desc' },
  { key: 'pressure', label: '中心气压（低→高）', defaultOrder: 'asc' },
  { key: 'updateTime', label: '更新时间（新→旧）', defaultOrder: 'desc' }
]

/** 排序字段 → 默认方向查表 */
export function defaultSortOrder(key) {
  return SORT_OPTIONS.find((o) => o.key === key)?.defaultOrder || 'desc'
}

/**
 * 多台风对比配色。
 *
 * 语义上必须与预警四色、强度色阶区分开：这组颜色只表达"第几个被对比的台风"，
 * 不代表危险程度。至多 4 条——超过 4 条叠加后地图与曲线会拥挤到不可读。
 */
export const COMPARE_COLORS = ['#38bdf8', '#fb923c', '#34d399', '#c084fc']

/** 对比数量上限（可读性约束，非技术限制） */
export const MAX_COMPARE = 4

/** 对比序列 → 配色，超出上限时循环取色，保证不出现 undefined 颜色 */
export function compareColor(index) {
  if (!Number.isFinite(index) || index < 0) return COMPARE_COLORS[0]
  return COMPARE_COLORS[index % COMPARE_COLORS.length]
}
