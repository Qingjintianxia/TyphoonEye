'use strict'

const express = require('express')
const router = express.Router()
const { typhoons, alerts } = require('../data/mock-data')

// 强度等级规范顺序（与前端 src/constants/typhoon.js 保持一致）
const LEVEL_ORDER = ['热带低压', '热带风暴', '强热带风暴', '台风', '强台风', '超强台风']

// 解析 'YYYY-MM-DD HH:mm' 的年份与月份
function getYear(t) { return t.startTime ? t.startTime.slice(0, 4) : '' }
function getMonth(t) {
  const m = parseInt((t.startTime || '').slice(5, 7), 10)
  return m >= 1 && m <= 12 ? m : 0
}

router.get('/', (req, res) => {
  const activeTyphoons = typhoons.filter((t) => t.status === 'active')
  const historicalTyphoons = typhoons.filter((t) => t.status === 'historical')
  const activeAlerts = alerts.filter((a) =>
    a.typhoonId && typhoons.find((t) => t.id === a.typhoonId && t.status === 'active')
  )
  const redAlerts = activeAlerts.filter((a) => a.level === 'red')

  const affectedCities = new Set()
  typhoons.forEach((t) => (t.affectedCities || []).forEach((c) => affectedCities.add(c)))

  // 月度频次：按 startTime 的月份聚合全部台风（实时计算，不再写死）
  const monthCounts = Array.from({ length: 12 }, () => 0)
  typhoons.forEach((t) => {
    const m = getMonth(t)
    if (m) monthCounts[m - 1] += 1
  })
  const monthlyData = monthCounts.map((count, i) => ({ month: `${i + 1}月`, count }))

  // 强度分布：按规范顺序输出，缺失等级记为 0（实时计算）
  const levelCounts = {}
  typhoons.forEach((t) => {
    levelCounts[t.level] = (levelCounts[t.level] || 0) + 1
  })
  const levelDistribution = LEVEL_ORDER.map((name) => ({ name, value: levelCounts[name] || 0 }))

  // 历年趋势：按年聚合，含当年超强/强台风数（实时计算）
  const yearMap = {}
  typhoons.forEach((t) => {
    const y = getYear(t)
    if (!y) return
    if (!yearMap[y]) yearMap[y] = { year: y, total: 0, super: 0 }
    yearMap[y].total += 1
    if (t.level === '超强台风' || t.level === '强台风') yearMap[y].super += 1
  })
  const yearTrend = Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year))

  const latestYear = typhoons.reduce((max, t) => {
    const y = parseInt(getYear(t), 10)
    return Number.isNaN(y) ? max : Math.max(max, y)
  }, 0)

  res.json({
    code: 200,
    data: {
      activeCount: activeTyphoons.length,
      alertCount: activeAlerts.length,
      redAlertCount: redAlerts.length,
      affectedCityCount: affectedCities.size,
      totalHistorical: historicalTyphoons.length,
      monthlyData,
      levelDistribution,
      yearTrend,
      year: latestYear
    }
  })
})

module.exports = router
