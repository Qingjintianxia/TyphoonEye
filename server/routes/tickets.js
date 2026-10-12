'use strict'

const express = require('express')
const jsonStore = require('../lib/jsonStore')
const dataPath = require('../lib/dataPath')
const {
  TICKET_STATUS,
  TIMELINE_TYPES,
  isStatus,
  canTransition,
  statusLabel,
  statusList
} = require('../constants/ticket')
const notify = require('../services/notify')

const router = express.Router()
const TICKETS_FILE = dataPath('tickets.json')

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function now() {
  return new Date().toISOString()
}

function fail(res, code, message) {
  return res.json({ code, message })
}

/** 排序：待处置/处置中在前，已闭环在后；同级按更新时间倒序 */
function sortTickets(list) {
  const order = { pending: 1, processing: 2, closed: 3 }
  return [...list].sort(
    (a, b) => (order[a.status] || 9) - (order[b.status] || 9) || String(b.updatedAt).localeCompare(String(a.updatedAt))
  )
}

// ---------- 列表 / 统计 ----------

router.get('/', (req, res) => {
  const { status, assignee, level, typhoonId } = req.query
  let list = jsonStore.read(TICKETS_FILE, [])

  if (status && isStatus(status)) list = list.filter((t) => t.status === status)
  if (assignee) list = list.filter((t) => t.assignee === assignee)
  if (level) list = list.filter((t) => t.level === level)
  if (typhoonId) list = list.filter((t) => t.typhoonId === typhoonId)

  res.json({ code: 200, data: sortTickets(list), total: list.length })
})

router.get('/stats', (req, res) => {
  const list = jsonStore.read(TICKETS_FILE, [])
  const byStatus = {}
  statusList().forEach((s) => { byStatus[s.key] = 0 })
  list.forEach((t) => { if (byStatus[t.status] !== undefined) byStatus[t.status] += 1 })

  res.json({
    code: 200,
    data: {
      total: list.length,
      byStatus,
      unassigned: list.filter((t) => !t.assignee && t.status !== TICKET_STATUS.CLOSED).length,
      closedRate: list.length ? Math.round((byStatus.closed / list.length) * 100) : 0
    }
  })
})

// ---------- 详情（必须在 /:id 之前声明具名路由） ----------

router.get('/:id', (req, res) => {
  const list = jsonStore.read(TICKETS_FILE, [])
  const ticket = list.find((t) => t.id === req.params.id)
  if (!ticket) return fail(res, 404, '工单不存在')
  res.json({ code: 200, data: ticket })
})

// ---------- 建单 ----------

router.post('/', wrap(async (req, res) => {
  const { alertId, typhoonId, typhoonName, city, level, title, description, assignee } = req.body

  if (!alertId) return fail(res, 400, '缺少预警 ID')
  if (!title && !typhoonName) return fail(res, 400, '缺少工单标题')

  const operator = req.user ? req.user.username : 'unknown'
  const createdAt = now()
  const ticket = {
    id: newId('TIC'),
    alertId,
    typhoonId: typhoonId || '',
    typhoonName: typhoonName || '',
    city: city || '',
    level: level || '',
    title: title || `${typhoonName || ''} 预警处置`,
    description: description || '',
    assignee: assignee || '',
    status: TICKET_STATUS.PENDING,
    createdBy: operator,
    createdAt,
    updatedAt: createdAt,
    timeline: [
      {
        id: newId('TL'),
        at: createdAt,
        operator,
        type: TIMELINE_TYPES.CREATE,
        content: assignee ? `创建工单，指派给 ${assignee}` : '创建工单，尚未指派'
      }
    ]
  }

  try {
    await jsonStore.mutate(TICKETS_FILE, (list) => {
      // 同一预警不得重复建单：否则用户连点几次就刷出一堆一模一样的工单
      const dup = list.find((t) => t.alertId === alertId && t.status !== TICKET_STATUS.CLOSED)
      if (dup) {
        const err = new Error(`该预警已有未闭环工单（${dup.id}），请勿重复创建`)
        err.conflict = true
        throw err
      }
      return [...list, ticket]
    })
  } catch (e) {
    if (e && e.conflict) return fail(res, 400, e.message)
    throw e
  }

  // 通知：有负责人就通知负责人，否则退回给创建者本人（不能没人知道）
  await notify.pushSafe({
    type: notify.NOTIFY_TYPES.TICKET_CREATED,
    title: `新工单：${ticket.title}`,
    content: `${ticket.city || '未指定城市'}｜${ticket.description || '请尽快处置'}`,
    level: ticket.level || 'blue',
    refType: 'ticket',
    refId: ticket.id,
    actor: operator,
    userId: ticket.assignee || operator
  })

  res.json({ code: 200, data: ticket, message: '工单已创建' })
}))

// ---------- 状态流转 ----------

router.patch('/:id/status', wrap(async (req, res) => {
  const { status, note } = req.body
  if (!isStatus(status)) return fail(res, 400, `目标状态非法：${status}`)

  const operator = req.user ? req.user.username : 'unknown'
  let updated = null
  let error = null

  await jsonStore.mutate(TICKETS_FILE, (list) => {
    const idx = list.findIndex((t) => t.id === req.params.id)
    if (idx === -1) {
      const e = new Error('工单不存在')
      e.notFound = true
      throw e
    }
    const ticket = list[idx]
    const check = canTransition(ticket.status, status)
    if (!check.ok) {
      const e = new Error(check.message)
      e.invalid = true
      throw e
    }
    const at = now()
    const next = {
      ...ticket,
      status,
      updatedAt: at,
      // 无人认领时记在发起人下
      assignee: ticket.assignee || (status === TICKET_STATUS.PROCESSING ? operator : ticket.assignee),
      timeline: [
        ...(ticket.timeline || []),
        {
          id: newId('TL'),
          at,
          operator,
          type: TIMELINE_TYPES.STATUS,
          from: ticket.status,
          to: status,
          content: note || `状态变更为「${statusLabel(status)}」`
        }
      ]
    }
    const copy = [...list]
    copy[idx] = next
    updated = next
    return copy
  }).catch((e) => { error = e })

  if (error) {
    if (error.notFound) return fail(res, 404, error.message)
    if (error.invalid) return fail(res, 400, error.message)
    throw error
  }

  // 通知负责人与创建者（去重）
  const targets = [...new Set([updated.assignee, updated.createdBy].filter(Boolean))]
  await Promise.all(
    targets.map((userId) =>
      notify.pushSafe({
        type: notify.NOTIFY_TYPES.TICKET_STATUS,
        title: `工单状态变更：${updated.title}`,
        content: `${statusLabel(updated.status)}${note ? '｜' + note : ''}`,
        level: updated.level || 'blue',
        refType: 'ticket',
        refId: updated.id,
        actor: operator,
        userId
      })
    )
  )

  res.json({ code: 200, data: updated, message: '状态已更新' })
}))

// ---------- 处置意见 ----------

router.post('/:id/comments', wrap(async (req, res) => {
  const content = (req.body && req.body.content ? String(req.body.content) : '').trim()
  if (!content) return fail(res, 400, '处置意见不能为空')

  const operator = req.user ? req.user.username : 'unknown'
  let updated = null
  let error = null

  await jsonStore.mutate(TICKETS_FILE, (list) => {
    const idx = list.findIndex((t) => t.id === req.params.id)
    if (idx === -1) {
      const e = new Error('工单不存在')
      e.notFound = true
      throw e
    }
    const ticket = list[idx]
    const at = now()
    const next = {
      ...ticket,
      updatedAt: at,
      timeline: [
        ...(ticket.timeline || []),
        { id: newId('TL'), at, operator, type: TIMELINE_TYPES.COMMENT, content }
      ]
    }
    const copy = [...list]
    copy[idx] = next
    updated = next
    return copy
  }).catch((e) => { error = e })

  if (error) {
    if (error.notFound) return fail(res, 404, error.message)
    throw error
  }
  const targets = [...new Set([updated.assignee, updated.createdBy].filter(Boolean))]
  await Promise.all(
    targets.map((userId) =>
      notify.pushSafe({
        type: notify.NOTIFY_TYPES.TICKET_COMMENT,
        title: `新处置意见：${updated.title}`,
        content,
        level: 'blue',
        refType: 'ticket',
        refId: updated.id,
        actor: operator,
        userId
      })
    )
  )

  // 已闭环的工单仍可追加意见，便于复盘时补充
  res.json({ code: 200, data: updated, message: '已记录处置意见' })
}))

module.exports = router
