'use strict'

/**
 * 地理计算单元测试
 *
 * 验证非法输入返回 null，不返回 0 或 NaN。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { haversineKm, nearestApproach, ringHit } = require('../../server/lib/geo')

test('haversineKm：上海 → 北京 约 1067km', () => {
  const d = haversineKm(31.23, 121.47, 39.9, 116.41)
  assert.ok(d > 1050 && d < 1090, `实际距离 ${d}km，应落在 1050~1090km`)
})

test('haversineKm：同点距离为 0', () => {
  assert.equal(haversineKm(22.5, 114.0, 22.5, 114.0), 0)
})

test('haversineKm：对称（A→B 与 B→A 一致）', () => {
  const a = haversineKm(22.5, 114.0, 31.23, 121.47)
  const b = haversineKm(31.23, 121.47, 22.5, 114.0)
  assert.ok(Math.abs(a - b) < 1e-9)
})

test('haversineKm：非法输入一律返回 null，不返回 0 或 NaN', () => {
  const cases = [
    [null, 114, 22, 113],
    [22, null, 22, 113],
    ['abc', 114, 22, 113],
    [22, 114, undefined, 113],
    [NaN, 114, 22, 113],
    [{}, [], 22, 113]
  ]
  cases.forEach((args) => {
    const d = haversineKm(...args)
    assert.equal(d, null, `输入 ${JSON.stringify(args)} 应返回 null，实际 ${d}`)
  })
})

test('nearestApproach：返回路径中最近的点', () => {
  const path = [
    { lat: 20, lng: 110, time: 't1' },
    { lat: 22.5, lng: 114.0, time: 't2' },
    { lat: 30, lng: 122, time: 't3' }
  ]
  const near = nearestApproach(path, 22.6, 114.1)
  assert.equal(near.index, 1)
  assert.equal(near.point.time, 't2')
  assert.ok(near.distanceKm < 20)
})

test('nearestApproach：空路径或非法坐标返回 null', () => {
  assert.equal(nearestApproach([], 22, 114), null)
  assert.equal(nearestApproach(null, 22, 114), null)
  assert.equal(nearestApproach([{ lat: 22, lng: 114 }], NaN, 114), null)
})

test('ringHit：距离恰好等于半径算命中（边界闭合）', () => {
  const t = { radius7: 300, radius10: 150, radius12: 60 }
  assert.equal(ringHit(60, t).level, 'red')
  assert.equal(ringHit(150, t).level, 'orange')
  assert.equal(ringHit(300, t).level, 'yellow')
})

test('ringHit：由内向外取最高级别（12 级圈优先）', () => {
  const t = { radius7: 300, radius10: 150, radius12: 60 }
  assert.equal(ringHit(10, t).key, 'radius12')
})

test('ringHit：超出最大风圈返回 null', () => {
  const t = { radius7: 300, radius10: 150, radius12: 60 }
  assert.equal(ringHit(301, t), null)
})

test('ringHit：半径缺失/非法时跳过该圈，不抛异常', () => {
  assert.equal(ringHit(10, {}), null)
  assert.equal(ringHit(10, { radius7: 0, radius10: -5, radius12: 'x' }), null)
  assert.equal(ringHit(null, { radius7: 300 }), null)
  assert.equal(ringHit(10, null), null)
})

test('ringHit：只有 7 级圈时按其判定', () => {
  assert.equal(ringHit(100, { radius7: 300 }).level, 'yellow')
  assert.equal(ringHit(400, { radius7: 300 }), null)
})
