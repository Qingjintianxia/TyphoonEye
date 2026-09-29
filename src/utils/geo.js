import { parseTime } from './format'

/**
 * 地理计算工具
 *
 * 统一约定：
 * 1. 所有函数对非法输入返回 null，绝不返回 NaN 或 0 这种"看起来像结果"的错误值
 * （算错的距离比没有距离更危险）。
 * 2. 使用 haversine 球面距离，不用平面欧氏距离——台风影响常跨 10 个经度以上，
 * 平面近似误差不可接受。
 */

const EARTH_RADIUS_KM = 6371

function toRad(deg) {
  return (deg * Math.PI) / 180
}

/**
 * 数值解析。
 *
 * 不能直接 `Number(v)`：Number(null) / Number('') / Number([]) / Number(false)
 * 全都是 0，缺失坐标会被当成"赤道与本初子午线交点"参与计算，
 * 得到一个看起来完全正常的巨大距离，进而让影响评估判成"无风险"。
 * 错误的距离比没有距离更危险，所以必须在此拦截。
 */
function num(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean' || typeof v === 'object') return null
  const s = typeof v === 'string' ? v.trim() : v
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 正数值（>0），用于风圈半径等"0 表示不存在"的字段 */
function positiveNum(v) {
  const n = num(v)
  return n !== null && n > 0 ? n : null
}

/**
 * 球面距离（km）。任一坐标非法则返回 null。
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const la1 = num(lat1)
  const ln1 = num(lng1)
  const la2 = num(lat2)
  const ln2 = num(lng2)
  if (la1 === null || ln1 === null || la2 === null || ln2 === null) return null

  const dLat = toRad(la2 - la1)
  const dLng = toRad(ln2 - ln1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * 沿路径求最近点。
 *
 * 这是本模块的核心价值：只看"当前中心距离"会误导——
 * 台风可能昨天更近（已过境）或明天更近（尚未到达）。
 *
 * @returns {{distanceKm:number,index:number,point:object}|null}
 */
export function nearestApproach(path, lat, lng) {
  if (!Array.isArray(path) || !path.length) return null
  const la = num(lat)
  const ln = num(lng)
  if (la === null || ln === null) return null

  let best = null
  path.forEach((p, i) => {
    if (!p) return
    const d = haversineKm(p.lat, p.lng, la, ln)
    if (d === null) return
    if (!best || d < best.distanceKm) {
      best = { distanceKm: d, index: i, point: p }
    }
  })
  return best
}

/**
 * 风圈命中判定。风圈是同心圆且 12 级最小，
 * 因此由内向外检查，第一个命中的就是最高级别。
 */
export function ringHit(distanceKm, typhoon) {
  const d = num(distanceKm)
  if (d === null || !typhoon) return null

  const rings = [
    { key: 'radius12', label: '12 级风圈', level: 'red' },
    { key: 'radius10', label: '10 级风圈', level: 'orange' },
    { key: 'radius7', label: '7 级风圈', level: 'yellow' }
  ]

  for (const r of rings) {
    const radius = positiveNum(typhoon[r.key])
    if (radius !== null && d <= radius) {
      return { key: r.key, label: r.label, radiusKm: radius, level: r.level }
    }
  }
  return null
}

/** 风险等级定义。warn 字段用于复用全局 .warn-tag 配色 */
export const RISK_LEVELS = {
  extreme: {
    key: 'extreme',
    label: '极高风险',
    warn: 'red',
    advice: '处于 12 级风圈影响范围，风力可达台风级，请立即停止户外活动并做好防风加固。'
  },
  high: {
    key: 'high',
    label: '高风险',
    warn: 'orange',
    advice: '处于 10 级风圈影响范围，可能出现严重风雨影响，请密切关注预警并提前做好准备。'
  },
  medium: {
    key: 'medium',
    label: '中风险',
    warn: 'yellow',
    advice: '处于 7 级风圈影响范围，将出现明显大风天气，请注意防范高空坠物与出行安全。'
  },
  low: {
    key: 'low',
    label: '低风险',
    warn: 'blue',
    advice: '位于台风外围影响区域，可能出现阵风与降雨，建议保持关注。'
  },
  none: {
    key: 'none',
    label: '暂无明显影响',
    warn: '',
    advice: '当前路径下未见明显影响，建议持续跟踪台风路径变化。'
  }
}

/**
 * 风险定级。
 * 兜底：三级风圈半径全部缺失时（如弱热带风暴），退化为距离阈值，
 * 避免出现"没风圈数据就永远显示无风险"的假阴性。
 */
export function assessRisk(nearestKm, typhoon) {
  const d = num(nearestKm)
  if (d === null) return RISK_LEVELS.none

  const t = typhoon || {}
  const r12 = positiveNum(t.radius12)
  const r10 = positiveNum(t.radius10)
  const r7 = positiveNum(t.radius7)

  if (r12 !== null && d <= r12) return RISK_LEVELS.extreme
  if (r10 !== null && d <= r10) return RISK_LEVELS.high
  if (r7 !== null && d <= r7) return RISK_LEVELS.medium
  if (r7 !== null && d <= r7 * 2) return RISK_LEVELS.low

  if (r7 === null && r10 === null && r12 === null) {
    if (d <= 100) return RISK_LEVELS.high
    if (d <= 300) return RISK_LEVELS.medium
    if (d <= 600) return RISK_LEVELS.low
  }
  return RISK_LEVELS.none
}

/** 判断某个时刻是否在 updateTime 之后（即属于预报段） */
function isFuturePoint(pointTime, updateTime) {
  const a = parseTime(pointTime)
  const b = parseTime(updateTime)
  if (!a || !b) return false
  return a.getTime() > b.getTime()
}

/**
 * 单城市综合评估。
 *
 * @param {object} typhoon 台风对象
 * @param {{name:string,lat:number,lng:number}} city 城市（必须带坐标）
 * @returns {object|null} 城市无坐标时返回 null
 */
export function assessCityImpact(typhoon, city) {
  const t = typhoon || {}
  if (!city) return null
  const la = num(city.lat)
  const ln = num(city.lng)
  if (la === null || ln === null) return null

  const path = Array.isArray(t.path) ? t.path : []

  // 中心：优先用台风实时经纬度，缺失时退化到路径末点
  let centerLat = num(t.latitude)
  let centerLng = num(t.longitude)
  if (centerLat === null || centerLng === null) {
    const last = path.length ? path[path.length - 1] : null
    if (last) {
      centerLat = num(last.lat)
      centerLng = num(last.lng)
    }
  }

  const currentKm = haversineKm(centerLat, centerLng, la, ln)
  const near = nearestApproach(path, la, ln)
  const hasPath = path.length > 0

  // 无路径数据时退化为当前距离，并在 UI 上标注无法计算最近距离
  const baseKm = near ? near.distanceKm : currentKm

  return {
    currentKm,
    nearestKm: baseKm,
    nearestPoint: near ? near.point : null,
    nearestIndex: near ? near.index : -1,
    isFuture: near ? isFuturePoint(near.point.time, t.updateTime) : false,
    hasPath,
    ring: ringHit(baseKm, t),
    risk: assessRisk(baseKm, t)
  }
}
