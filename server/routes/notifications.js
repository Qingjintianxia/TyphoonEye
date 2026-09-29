'use strict'

const express = require('express')
const router = express.Router()
const jsonStore = require('../lib/jsonStore')
const notify = require('../services/notify')

const { NOTIFICATIONS_FILE, isVisible, isRead, unreadCount } = notify

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function me(req) {
  return req.user ? req.user.username : ''
}

function fail(res, code, message) {
  return res.json({ code, message })
}

/** 列表：本人消息 + 广播消息，按时间倒序 */
router.get('/', (req, res) => {
  const username = me(req)
  const list = jsonStore.read(NOTIFICATIONS_FILE, [])
    .filter((n) => isVisible(n, username))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((n) => ({ ...n, read: isRead(n, username) }))

  res.json({ code: 200, data: list, total: list.length, unread: unreadCount(jsonStore.read(NOTIFICATIONS_FILE, []), username) })
})

/** 未读数：角标专用轻量接口 */
router.get('/unread-count', (req, res) => {
  const username = me(req)
  const list = jsonStore.read(NOTIFICATIONS_FILE, [])
  res.json({ code: 200, data: { unread: unreadCount(list, username) } })
})

/** 单条已读 */
router.patch('/:id/read', wrap(async (req, res) => {
  const username = me(req)
  if (!username) return fail(res, 401, '请先登录')

  let updated = null
  let error = null
  await jsonStore.mutate(NOTIFICATIONS_FILE, (list) => {
    const idx = list.findIndex((n) => n.id === req.params.id && isVisible(n, username))
    if (idx === -1) {
      const e = new Error('通知不存在')
      e.notFound = true
      throw e
    }
    const item = list[idx]
    if (isRead(item, username)) { updated = item; return list }
    const next = { ...item, readBy: [...(item.readBy || []), username] }
    const copy = [...list]
    copy[idx] = next
    updated = next
    return copy
  }).catch((e) => { error = e })

  if (error) {
    if (error.notFound) return fail(res, 404, error.message)
    throw error
  }
  res.json({ code: 200, data: updated })
}))

/** 全部已读 */
router.post('/read-all', wrap(async (req, res) => {
  const username = me(req)
  if (!username) return fail(res, 401, '请先登录')

  let count = 0
  await jsonStore.mutate(NOTIFICATIONS_FILE, (list) =>
    list.map((n) => {
      if (!isVisible(n, username) || isRead(n, username)) return n
      count += 1
      return { ...n, readBy: [...(n.readBy || []), username] }
    })
  )
  res.json({ code: 200, data: { updated: count }, message: `已将 ${count} 条标记为已读` })
}))

module.exports = router
