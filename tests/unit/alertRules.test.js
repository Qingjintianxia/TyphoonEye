'use strict'

/**
 * 预警规则引擎单元测试
 *
 * 最关键的用例是幂等：同一输入两次派生必须得到同一组 ID。
 * 若 ID 不稳定，工单与通知将永远对不上它引用的那条预警。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { deriveAlerts, listRules } = require('../../server/services/alertRules')

/** 构造最小化台风夹具：只填规则引擎真正读取的字段 */
function makeTyphoon(overrides = {}) {
  return {
    id: 'TY-TEST',
    name: '测试台风',
    nameEn: 'TEST',
    status: 'active',
    latitude: 22.5,
    longitude: 114.0,
    windSpeed: 45,
    pressure: 960,
    radius7: 300,
    radius10: 150,
    radius12: 60,
    affectedCities: [],
    path: [{ lat: 22.5, lng: 114.0, time: '2026-01-01T00:00:00.000Z', wind: 45, level: '台风' }],
    ...overrides
  }
}

const IDS = (list) => list.map((a) => a.id).sort()

test('风圈命中：城市在 12 级圈内产出红色预警', () => {
  // 深圳（22.54, 114.06）到中心（22.5, 114.0）约 7km，远小于 radius12=60
  const t = makeTyphoon({ affectedCities: ['深圳'] })
  const list = deriveAlerts([t], { cities: ['深圳'], now: '2026-01-01T00:00:00.000Z' })

  assert.equal(list.length, 1)
  assert.equal(list[0].level, 'red')
  assert.equal(list[0].ruleKey, 'RING_12')
  assert.equal(list[0].source, 'rule')
  assert.equal(list[0].city, '深圳')
})

test('幂等：同一输入两次派生，ID 集合完全一致', () => {
  const t = makeTyphoon({ affectedCities: ['深圳', '广州'] })
  const opts = { cities: ['深圳', '广州'], now: '2026-01-01T00:00:00.000Z' }

  const a = deriveAlerts([t], opts)
  const b = deriveAlerts([t], opts)
  assert.deepEqual(IDS(a), IDS(b))
})

test('预警 ID 具备确定性结构 RULE-<台风>-<城市>-<规则>', () => {
  const t = makeTyphoon({ affectedCities: ['深圳'] })
  const [alert] = deriveAlerts([t], { cities: ['深圳'] })
  assert.equal(alert.id, 'RULE-TY-TEST-深圳-RING_12')
})

test('只处理活跃台风：historical 不产出任何预警', () => {
  const t = makeTyphoon({ status: 'historical', affectedCities: ['深圳'] })
  assert.deepEqual(deriveAlerts([t], { cities: ['深圳'] }), [])
})

test('空输入与非数组输入安全降级', () => {
  assert.deepEqual(deriveAlerts([]), [])
  assert.deepEqual(deriveAlerts(null), [])
  assert.deepEqual(deriveAlerts('x'), [])
})

test('同一城市只保留一条预警（最严重者胜出）', () => {
  const t = makeTyphoon({ affectedCities: ['深圳', '广州'] })
  const list = deriveAlerts([t], { cities: ['深圳', '广州'] })

  const keys = list.map((a) => `${a.typhoonId}::${a.city}`)
  assert.equal(new Set(keys).size, keys.length, '同一 (台风, 城市) 只能出现一次')
})

test('降噪：非声明城市的「外围关注」不产出预警', () => {
  // 中心放在上海西北约 320km 处：不进任何风圈，但满足 WATCH（≤500km 且风速 ≥24.5）
  const t = makeTyphoon({
    latitude: 34.0,
    longitude: 122.5,
    windSpeed: 30,
    radius7: 0,
    radius10: 0,
    radius12: 0,
    affectedCities: [],
    path: [{ lat: 34.0, lng: 122.5, time: '2026-01-01T00:00:00.000Z', wind: 30, level: '强热带风暴' }]
  })

  const suppressed = deriveAlerts([t], { cities: ['上海'] })
  assert.equal(suppressed.length, 0, '非声明城市不应因 WATCH 规则产生噪音')

  const declared = deriveAlerts([{ ...t, affectedCities: ['上海'] }], { cities: ['上海'] })
  assert.equal(declared.length, 1)
  assert.equal(declared[0].ruleKey, 'WATCH')
})

test('极低压修正：≤950hPa 且贴近时上调一级', () => {
  const base = {
    latitude: 24.0,
    longitude: 117.0,
    radius7: 300,
    radius10: 0,
    radius12: 0,
    affectedCities: ['汕头'],
    path: [{ lat: 24.0, lng: 117.0, time: '2026-01-01T00:00:00.000Z', wind: 30, level: '强热带风暴' }]
  }
  const opts = { cities: ['汕头'] }

  const normal = deriveAlerts([makeTyphoon({ ...base, pressure: 960 })], opts)
  assert.equal(normal[0].level, 'yellow')
  assert.equal(normal[0].escalated, false)

  const deep = deriveAlerts([makeTyphoon({ ...base, pressure: 940 })], opts)
  assert.equal(deep[0].level, 'orange')
  assert.equal(deep[0].escalated, true)
  assert.match(deep[0].reason, /中心气压 940 hPa/)
})

test('极低压修正：气压缺失不得触发升级（避免 Number(null)=0 被当成 0hPa）', () => {
  const t = {
    latitude: 24.0,
    longitude: 117.0,
    radius7: 300,
    radius10: 0,
    radius12: 0,
    pressure: null,
    affectedCities: ['汕头'],
    path: [{ lat: 24.0, lng: 117.0, time: '2026-01-01T00:00:00.000Z', wind: 30, level: '强热带风暴' }]
  }
  const list = deriveAlerts([makeTyphoon(t)], { cities: ['汕头'] })
  assert.equal(list.length, 1)
  assert.equal(list[0].level, 'yellow', '气压缺失时不应上调级别')
  assert.equal(list[0].escalated, false)
})

test('结果按严重程度降序（红→橙→黄→蓝）', () => {
  const list = deriveAlerts([makeTyphoon({ affectedCities: ['深圳', '广州', '汕头'] })])
  const rank = { red: 4, orange: 3, yellow: 2, blue: 1 }
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(rank[list[i - 1].level] >= rank[list[i].level], '级别必须单调不增')
  }
})

test('每条预警都带可解释字段', () => {
  const list = deriveAlerts([makeTyphoon({ affectedCities: ['深圳'] })])
  assert.ok(list.length > 0)
  list.forEach((a) => {
    assert.ok(a.ruleKey, '缺少 ruleKey')
    assert.ok(a.ruleLabel, '缺少 ruleLabel')
    assert.ok(a.reason, '缺少 reason')
    assert.equal(typeof a.distanceKm, 'number')
  })
})

test('listRules：规则清单完整且含风圈与距离两类', () => {
  const rules = listRules()
  const keys = rules.map((r) => r.key)
  assert.deepEqual(keys, ['RING_12', 'RING_10', 'RING_7', 'STRONG_NEAR', 'WATCH'])
  rules.forEach((r) => assert.ok(r.label && r.describe && r.level))
})
