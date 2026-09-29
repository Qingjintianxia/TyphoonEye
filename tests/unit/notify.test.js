'use strict'

/**
 * 消息服务单元测试
 *
 * 核心是广播消息的按人已读：readBy 是数组而非布尔。
 * 若退化成布尔，A 点"全部已读"会把 B 的消息也标记为已读 —— 这在集成测试里很容易漏掉。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { isVisible, isRead, unreadCount, NOTIFY_TYPES } = require('../../server/services/notify')

const personal = (userId, readBy = []) => ({ id: 'n1', userId, readBy })
const broadcast = (readBy = []) => ({ id: 'n2', userId: null, readBy })

test('isVisible：定向消息只有接收者可见', () => {
  const n = personal('alice')
  assert.equal(isVisible(n, 'alice'), true)
  assert.equal(isVisible(n, 'bob'), false)
})

test('isVisible：广播消息对所有人可见', () => {
  const n = broadcast()
  assert.equal(isVisible(n, 'alice'), true)
  assert.equal(isVisible(n, 'bob'), true)
})

test('isVisible：空数据返回 false', () => {
  assert.equal(isVisible(null, 'alice'), false)
  assert.equal(isVisible(undefined, ''), false)
})

test('isRead：按人判定，互不影响', () => {
  const n = broadcast(['alice'])
  assert.equal(isRead(n, 'alice'), true)
  assert.equal(isRead(n, 'bob'), false, 'alice 已读不应影响 bob')
})

test('isRead：readBy 缺失也安全', () => {
  assert.equal(isRead({ userId: 'a' }, 'a'), false)
})

test('unreadCount：只统计"可见且未读"', () => {
  const list = [personal('alice'), personal('bob'), broadcast(), broadcast(['alice'])]
  // alice 可见 3 条（自己的 + 2 条广播），其中 1 条已读
  assert.equal(unreadCount(list, 'alice'), 2)
  // bob 可见 3 条，全部未读
  assert.equal(unreadCount(list, 'bob'), 3)
})

test('unreadCount：空列表与非法输入安全', () => {
  assert.equal(unreadCount([], 'alice'), 0)
  assert.equal(unreadCount(null, 'alice'), 0)
  assert.equal(unreadCount(undefined, 'alice'), 0)
})

test('NOTIFY_TYPES 覆盖四类业务事件', () => {
  assert.deepEqual(Object.values(NOTIFY_TYPES).sort(), [
    'alert_dispatch',
    'ticket_comment',
    'ticket_created',
    'ticket_status'
  ])
})
