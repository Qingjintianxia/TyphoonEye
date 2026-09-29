/**
 * 格式化工具集
 *
 * 统一约定：所有函数对 null / undefined / NaN 一律返回占位符 '—'，绝不抛异常。
 * 这是前端空值白屏问题的第一道防线。
 */

/** 空值占位符 */
export const EMPTY = '—'

function isBlank(v) {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))
}

/**
 * 解析时间，兼容 'YYYY-MM-DD HH:mm' 与 ISO 8601 两种格式。
 * 原实现直接使用 new Date('2026-05-19 14:00')，在严格 ISO 环境下会得到 Invalid Date，
 * 导致预警排序失效（见 server/routes/alerts.js）。
 * @returns {Date|null}
 */
export function parseTime(value) {
  if (isBlank(value)) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  let raw = String(value).trim()
  // 'YYYY-MM-DD HH:mm' → 'YYYY-MM-DDTHH:mm'（按本地时区解析，与后端展示口径一致）
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw)) {
    raw = raw.replace(' ', 'T')
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 统一输出 ISO 8601 字符串（带时区偏移），用于排序与传输。
 * @returns {string|null}
 */
export function toISOTime(value) {
  const d = parseTime(value)
  return d ? d.toISOString() : null
}

/** 数值 + 单位格式化 */
export function formatNumber(value, { unit = '', digits = 0, fallback = EMPTY } = {}) {
  if (isBlank(value)) return fallback
  const n = Number(value)
  if (Number.isNaN(n)) return fallback
  const text = digits > 0 ? n.toFixed(digits) : String(Math.round(n * 100) / 100)
  return unit ? `${text} ${unit}` : text
}

/** 风速，单位 m/s */
export function formatWind(value) {
  return formatNumber(value, { unit: 'm/s' })
}

/** 气压，单位 hPa */
export function formatPressure(value) {
  return formatNumber(value, { unit: 'hPa' })
}

/** 坐标格式化：21.5°N, 126.8°E */
export function formatCoord(lat, lng, digits = 1) {
  if (isBlank(lat) || isBlank(lng)) return EMPTY
  const la = Number(lat)
  const ln = Number(lng)
  if (Number.isNaN(la) || Number.isNaN(ln)) return EMPTY
  const ns = la >= 0 ? 'N' : 'S'
  const ew = ln >= 0 ? 'E' : 'W'
  return `${Math.abs(la).toFixed(digits)}°${ns}, ${Math.abs(ln).toFixed(digits)}°${ew}`
}

/** 日期时间：2026-05-19 14:00 */
export function formatDateTime(value) {
  const d = parseTime(value)
  if (!d) return EMPTY
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 仅日期：2026-05-19 */
export function formatDate(value) {
  const d = parseTime(value)
  if (!d) return EMPTY
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 年份 */
export function formatYear(value) {
  const d = parseTime(value)
  return d ? String(d.getFullYear()) : EMPTY
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * 相对时间：刚刚 / 12 分钟前 / 3 小时前 / 2 天前
 * 超过 7 天退回绝对日期，避免出现"213 天前"这类无信息量的文案。
 */
export function relativeTime(value) {
  const d = parseTime(value)
  if (!d) return EMPTY
  const diff = Date.now() - d.getTime()
  if (diff < 0) {
    // 未来时间（预报数据常见），给出正向描述
    const ahead = -diff
    if (ahead < HOUR) return `${Math.max(1, Math.round(ahead / MINUTE))} 分钟后`
    if (ahead < DAY) return `${Math.round(ahead / HOUR)} 小时后`
    return `${Math.round(ahead / DAY)} 天后`
  }
  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.round(diff / HOUR)} 小时前`
  if (diff < 7 * DAY) return `${Math.round(diff / DAY)} 天前`
  return formatDate(value)
}

/**
 * 数据新鲜度等级，用于 UI 上标注"数据可能过期"
 * @returns 'fresh' | 'stale' | 'expired' | 'unknown'
 */
export function freshness(value, { staleAfter = 3 * HOUR, expiredAfter = 24 * HOUR } = {}) {
  const d = parseTime(value)
  if (!d) return 'unknown'
  const diff = Date.now() - d.getTime()
  if (diff > expiredAfter) return 'expired'
  if (diff > staleAfter) return 'stale'
  return 'fresh'
}

/** 百分比，自动处理分母为 0 */
export function formatPercent(part, total, digits = 0) {
  if (!total) return '0%'
  return `${((part / total) * 100).toFixed(digits)}%`
}

/** 安全的数组长度读取，避免 undefined.length */
export function safeList(list) {
  return Array.isArray(list) ? list : []
}
