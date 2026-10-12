'use strict'

/**
 * 预警规则引擎，纯函数、零 I/O，输入台风与城市即可输出预警。
 *
 * 预警 ID 由（台风、城市、规则）确定生成，接口每次实时派生，
 * 工单与通知据此稳定关联到同一条预警。
 * 每条预警带 ruleKey / ruleLabel / reason；同一城市命中多条规则时
 * 只保留最严重的，其余记在 suppressed 里。
 */

const { haversineKm, nearestApproach, ringHit } = require('../lib/geo')
const { allCities, findCity, canonicalCityName } = require('../data/cities')

/** 级别序：越大越严重，用于比较与上调 */
const LEVEL_RANK = { blue: 1, yellow: 2, orange: 3, red: 4 }

const LEVEL_LABEL = {
  red: '红色预警',
  orange: '橙色预警',
  yellow: '黄色预警',
  blue: '蓝色预警'
}

/** 风圈命中规则，命中判定由 lib/geo.ringHit() 完成，这里只提供展示元数据 */
const RING_RULES = [
  { key: 'RING_12', label: '12 级风圈命中', describe: '城市到台风路径最近距离 ≤ 12 级风圈半径', level: 'red' },
  { key: 'RING_10', label: '10 级风圈命中', describe: '城市到台风路径最近距离 ≤ 10 级风圈半径', level: 'orange' },
  { key: 'RING_7', label: '7 级风圈命中', describe: '城市到台风路径最近距离 ≤ 7 级风圈半径', level: 'yellow' }
]

/** 风圈字段 → 规则 key */
const RING_KEY_BY_FIELD = { radius12: 'RING_12', radius10: 'RING_10', radius7: 'RING_7' }

/**
 * 距离/强度规则：未进风圈时按"逼近程度 + 自身强度"预警。
 * 顺序即优先级，自上而下命中即停。
 * test(ctx, typhoon) 返回命中对象或 null。
 */
const DISTANCE_RULES = [
  {
    key: 'STRONG_NEAR',
    label: '强台风逼近',
    describe: '最近距离 ≤ 300km 且中心风速 ≥ 41.5 m/s（台风级）',
    level: 'orange',
    test: (ctx, t) => (ctx.distanceKm <= 300 && Number(t.windSpeed) >= 41.5 ? {} : null)
  },
  {
    key: 'WATCH',
    label: '外围关注',
    describe: '最近距离 ≤ 500km 且中心风速 ≥ 24.5 m/s（强热带风暴级）',
    level: 'yellow',
    test: (ctx, t) => (ctx.distanceKm <= 500 && Number(t.windSpeed) >= 24.5 ? {} : null)
  }
]

/** 极低压叠加修正：不单独成条，只在命中风圈且贴近时上调一级 */
function pressureEscalation(near, typhoon) {
  const r7 = positiveNum(typhoon.radius7)
  const pressure = num(typhoon.pressure)
  // 气压缺失时不参与升级判定
  if (pressure === null) return null
  if (r7 === null) return null
  if (pressure > 950) return null
  if (near.distanceKm > r7 * 1.5) return null
  return { reason: `中心气压 ${pressure} hPa（≤950），影响程度上调一级` }
}

function num(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean' || typeof v === 'object') return null
  const s = typeof v === 'string' ? v.trim() : v
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** 正数值（>0），用于"0 表示不存在"的风圈半径字段 */
function positiveNum(v) {
  const n = num(v)
  return n !== null && n > 0 ? n : null
}

/** 确定性 ID：同一 (台风, 城市, 规则) 永远得到同一个 ID */
function makeId(typhoonId, city, ruleKey) {
  return `RULE-${typhoonId}-${city}-${ruleKey}`
}

function formatKm(km) {
  return `${Math.round(km)}km`
}

/**
 * 对单个台风 × 单个城市求值，返回命中结果（未命中返回 null）
 */
function evaluateCity(typhoon, city) {
  if (!typhoon || !city) return null

  const path = Array.isArray(typhoon.path) ? typhoon.path : []
  const near = nearestApproach(path, city.lat, city.lng)
  // 无路径时退化为当前中心距离；两者都取不到则跳过（不臆造数据）
  const currentKm = haversineKm(typhoon.latitude, typhoon.longitude, city.lat, city.lng)
  const distanceKm = near ? near.distanceKm : currentKm
  if (distanceKm === null) return null

  const ring = ringHit(distanceKm, typhoon)
  const ctx = { distanceKm, ring, point: near ? near.point : null }

  // 风圈命中优先（ring 已由内向外取到最高级别）；未进圈才走距离/强度规则
  let hit = null
  if (ring) {
    hit = { ruleKey: RING_KEY_BY_FIELD[ring.key], level: ring.level }
  } else {
    for (const rule of DISTANCE_RULES) {
      if (rule.test(ctx, typhoon)) { hit = { ruleKey: rule.key, level: rule.level }; break }
    }
  }
  if (!hit) return null

  const rule = [...RING_RULES, ...DISTANCE_RULES].find((r) => r.key === hit.ruleKey)
  let level = hit.level

  // 极低压修正
  const esc = pressureEscalation(ctx, typhoon)
  if (esc && LEVEL_RANK[level] < LEVEL_RANK.red) {
    level = level === 'yellow' ? 'orange' : 'red'
  }

  const wind = num(typhoon.windSpeed)
  const reasonParts = [
    `最近距离 ${formatKm(distanceKm)}`,
    ring ? `落入${ring.label}（半径 ${Math.round(ring.radiusKm)}km）` : '未进入风圈',
    wind !== null ? `中心风速 ${wind} m/s` : null,
    esc ? esc.reason : null
  ].filter(Boolean)

  return {
    ruleKey: rule.key,
    ruleLabel: rule.label,
    ruleDescribe: rule.describe,
    level,
    distanceKm: Math.round(distanceKm * 100) / 100,
    reason: reasonParts.join('，'),
    at: ctx.point ? ctx.point.time : null,
    escalated: !!esc
  }
}

/**
 * 派生预警主入口。
 *
 * @param {object[]} typhoons 台风列表（内部只处理 status==='active'）
 * @param {object} [options]
 * @param {string[]} [options.cities] 参与计算的城市名；缺省用台风的 affectedCities + 全量表
 * @param {string} [options.now] 发布时间（便于测试固定时间）
 * @returns {object[]} 派生预警数组
 */
function deriveAlerts(typhoons, options = {}) {
  const list = Array.isArray(typhoons) ? typhoons : []
  const active = list.filter((t) => t && t.status === 'active')
  if (!active.length) return []

  const now = options.now || new Date().toISOString()
  const out = []

  active.forEach((t) => {
    // 城市范围：台风声明的影响城市（别名归一）优先，再补上全量沿海城市
    const declared = (Array.isArray(t.affectedCities) ? t.affectedCities : [])
      .map((n) => canonicalCityName(n))
      .filter(Boolean)
    const extras = Array.isArray(options.cities) && options.cities.length
      ? options.cities.map((n) => canonicalCityName(n))
      : allCities().map((c) => c.name)
    const cityNames = [...new Set([...declared, ...extras])]

    cityNames.forEach((name) => {
      const city = findCity(name)
      if (!city) return // 未收录坐标的城市不参与计算，绝不臆造距离
      const hit = evaluateCity(t, city)
      if (!hit) return

      // 降噪：非台风声明城市的"外围关注"不预警。
      // 否则一个台风会给整条海岸线每个城市都发一条黄色预警，预警中心会被噪音淹没。
      if (!declared.includes(name) && hit.ruleKey === 'WATCH') return

      out.push({
        id: makeId(t.id, city.name, hit.ruleKey),
        typhoonId: t.id,
        typhoonName: t.name,
        level: hit.level,
        levelLabel: LEVEL_LABEL[hit.level] || hit.level,
        title: `${t.name} · ${city.name}${LEVEL_LABEL[hit.level] || ''}`,
        content: `${t.name}（${t.nameEn || ''}）${hit.ruleLabel}：${hit.reason}。${hit.ruleDescribe}。`,
        city: city.name,
        distanceKm: hit.distanceKm,
        publishTime: now,
        // 来源与可解释字段：让用户知道这是机器派生而非人工研判
        source: 'rule',
        ruleKey: hit.ruleKey,
        ruleLabel: hit.ruleLabel,
        ruleDescribe: hit.ruleDescribe,
        reason: hit.reason,
        escalated: hit.escalated
      })
    })
  })

  // 同一城市只保留最严重的一条，被抑制的规则记入 suppressed
  const byCity = new Map()
  out.forEach((a) => {
    const key = `${a.typhoonId}::${a.city}`
    const prev = byCity.get(key)
    if (!prev) { byCity.set(key, a); return }
    if (LEVEL_RANK[a.level] > LEVEL_RANK[prev.level]) {
      a.suppressed = [...(prev.suppressed || []), prev.ruleKey]
      byCity.set(key, a)
    } else {
      prev.suppressed = [...(prev.suppressed || []), a.ruleKey]
    }
  })

  return [...byCity.values()].sort(
    (a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.distanceKm - b.distanceKm
  )
}

/** 规则清单（供前端展示"预警是怎么来的"） */
function listRules() {
  return [...RING_RULES, ...DISTANCE_RULES].map((r) => ({
    key: r.key,
    label: r.label,
    describe: r.describe,
    level: r.level
  }))
}

module.exports = { deriveAlerts, listRules, evaluateCity, LEVEL_RANK, LEVEL_LABEL }
