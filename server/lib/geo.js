'use strict'

/**
 * 服务端地理计算
 *
 * 与前端 src/utils/geo.js 为同源双份：服务端是 CommonJS 且不能 import 前端 ESM 模块，
 * 只能镜像一份。因此——改一侧必须同步另一侧，口径不一致会导致前后端结论打架。
 *
 * 统一约定（与前端一致）：
 * 1. 非法输入返回 null，绝不返回 0 / NaN —— 错误的距离比没有距离更危险。
 * 2. 用 haversine 球面距离，不用平面欧氏距离。
 */

const EARTH_RADIUS_KM = 6371

/**
 * 数值解析。
 *
 * 不能直接 `Number(v)`：Number(null) / Number('') / Number([]) / Number(false)
 * 全都是 0，缺失坐标会被当成"赤道与本初子午线交点"参与计算，
 * 得到一个看起来完全正常的巨大距离，进而让规则引擎静默跳过该城市。
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

function positiveNum(v) {
  const n = num(v)
  return n !== null && n > 0 ? n : null
}

function toRad(deg) {
  return (deg * Math.PI) / 180
}

/** 球面距离（km），任一坐标非法返回 null */
function haversineKm(lat1, lng1, lat2, lng2) {
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
 * 沿路径求最近点。只看"当前中心距离"会误导：
 * 台风可能昨天更近（已过境）或明天更近（尚未到达）。
 */
function nearestApproach(path, lat, lng) {
  if (!Array.isArray(path) || !path.length) return null
  const la = num(lat)
  const ln = num(lng)
  if (la === null || ln === null) return null

  let best = null
  path.forEach((p, i) => {
    if (!p) return
    const d = haversineKm(p.lat, p.lng, la, ln)
    if (d === null) return
    if (!best || d < best.distanceKm) best = { distanceKm: d, index: i, point: p }
  })
  return best
}

/**
 * 风圈命中判定。风圈同心且 12 级最小，由内向外检查，第一个命中即最高级别。
 */
function ringHit(distanceKm, typhoon) {
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

module.exports = { haversineKm, nearestApproach, ringHit }
