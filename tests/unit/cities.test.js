'use strict'

/**
 * 城市坐标表单元测试
 *
 * 别名映射一旦漏掉，「香港」就会查不到坐标 —— 这不会报错，
 * 而是让规则引擎静默跳过该城市（假阴性），是最难发现的一类 bug。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { allCities, findCity, canonicalCityName, CITY_COORDS } = require('../../server/data/cities')

test('别名归一：香港 / 澳门 → 中国香港 / 中国澳门', () => {
  assert.equal(canonicalCityName('香港'), '中国香港')
  assert.equal(canonicalCityName('澳门'), '中国澳门')
  assert.equal(findCity('香港').name, '中国香港')
  assert.equal(findCity('澳门').name, '中国澳门')
})

test('标准名原样返回', () => {
  assert.equal(canonicalCityName('中国香港'), '中国香港')
  assert.equal(canonicalCityName('深圳'), '深圳')
})

test('空值与空白安全降级', () => {
  assert.equal(canonicalCityName(''), '')
  assert.equal(canonicalCityName(null), '')
  assert.equal(findCity(''), null)
  assert.equal(findCity(null), null)
})

test('未收录城市返回 null，绝不臆造坐标', () => {
  assert.equal(findCity('不存在的城市'), null)
  assert.equal(findCity('   '), null)
})

test('trim 后再匹配', () => {
  assert.equal(findCity('  深圳  ').name, '深圳')
})

test('城市表无重复名称', () => {
  const names = CITY_COORDS.map((c) => c.name)
  assert.equal(new Set(names).size, names.length, '存在重复城市名')
})

test('每个城市都有合法经纬度', () => {
  CITY_COORDS.forEach((c) => {
    assert.ok(Number.isFinite(c.lat), `${c.name} 纬度非法`)
    assert.ok(Number.isFinite(c.lng), `${c.name} 经度非法`)
    assert.ok(c.lat > 15 && c.lat < 45, `${c.name} 纬度超出国内范围`)
    assert.ok(c.lng > 105 && c.lng < 130, `${c.name} 经度超出沿海范围`)
  })
})

test('allCities 按纬度由北到南排序', () => {
  const list = allCities()
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(list[i - 1].lat >= list[i].lat, '应按纬度降序')
  }
})

test('allCities 返回副本，外部修改不污染原表', () => {
  const list = allCities()
  list.push({ name: '污染项', lat: 0, lng: 0 })
  assert.equal(allCities().find((c) => c.name === '污染项'), undefined)
})
