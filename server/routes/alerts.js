'use strict'

const express = require('express')
const router = express.Router()
const { alerts, typhoons } = require('../data/mock-data')
const { deriveAlerts, listRules } = require('../services/alertRules')
const notify = require('../services/notify')

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/**
 * 人工发布的预警：mock 静态数据，标注 source='manual'。
 * 与规则派生结果分区可辨，避免用户误以为是人工研判结论。
 */
function manualAlerts() {
  return (alerts || []).map((a) => ({ ...a, source: 'manual' }))
}

router.get('/', (req, res) => {
  const { level, source, city, typhoonId } = req.query

  // 派生预警：每次实时计算。ID 由 (台风, 城市, 规则) 确定性生成，
  // 因此结果稳定，工单与通知才能稳定关联 —— 落盘反而会引入"数据陈旧"。
  const derived = deriveAlerts(typhoons)

  let result = [...manualAlerts(), ...derived]

  if (level) result = result.filter((a) => a.level === level)
  if (source) result = result.filter((a) => a.source === source)
  if (city) result = result.filter((a) => a.city === city)
  if (typhoonId) result = result.filter((a) => a.typhoonId === typhoonId)

  result.sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime))

  res.json({
    code: 200,
    data: result,
    total: result.length,
    // 分项计数便于前端展示"人工 N 条 / 规则派生 N 条"
    breakdown: {
      manual: manualAlerts().length,
      rule: derived.length
    }
  })
})

/** 规则清单：前端用于解释"这条预警是怎么来的" */
router.get('/rules', (req, res) => {
  res.json({ code: 200, data: listRules() })
})

/**
 * 预警推送：把选中的预警转成消息中心通知。
 * assignee 为空时为全体广播（userId=null）。
 */
router.post('/dispatch', wrap(async (req, res) => {
  const { alertIds, assignee } = req.body || {}
  if (!Array.isArray(alertIds) || !alertIds.length) {
    return res.json({ code: 400, message: '请选择要推送的预警' })
  }

  const operator = req.user ? req.user.username : 'unknown'
  const pool = [...manualAlerts(), ...deriveAlerts(typhoons)]
  const picked = pool.filter((a) => alertIds.includes(a.id))
  if (!picked.length) {
    return res.json({ code: 404, message: '未找到对应的预警' })
  }

  let sent = 0
  for (const alert of picked) {
    const n = await notify.pushSafe({
      type: notify.NOTIFY_TYPES.ALERT_DISPATCH,
      title: `预警推送：${alert.title}`,
      content: `${alert.city || ''}｜${alert.content || ''}`,
      level: alert.level || 'blue',
      refType: 'alert',
      refId: alert.id,
      actor: operator,
      userId: assignee || null
    })
    if (n) sent += 1
  }

  res.json({ code: 200, data: { sent, total: picked.length }, message: `已推送 ${sent} 条` })
}))

module.exports = router
