'use strict'

/**
 * 工单状态机单元测试
 *
 * 前端 UI 的禁用按钮与后端的最终裁决共用这一张转移表，
 * 这里穷举 from × to 逐一校验。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const {
  TICKET_STATUS,
  STATUS_META,
  ALLOWED_TRANSITIONS,
  isStatus,
  canTransition,
  statusLabel,
  statusList
} = require('../../server/constants/ticket')

test('isStatus：只认三个合法状态', () => {
  assert.equal(isStatus('pending'), true)
  assert.equal(isStatus('processing'), true)
  assert.equal(isStatus('closed'), true)
  assert.equal(isStatus(''), false)
  assert.equal(isStatus('PENDING'), false)
  assert.equal(isStatus(null), false)
})

test('状态转移矩阵与 ALLOWED_TRANSITIONS 完全一致', () => {
  Object.keys(STATUS_META).forEach((from) => {
    Object.keys(STATUS_META).forEach((to) => {
      const expected = from !== to && (ALLOWED_TRANSITIONS[from] || []).includes(to)
      assert.equal(canTransition(from, to).ok, expected, `${from}→${to} 判定不符`)
    })
  })
})

test('pending 只能进 processing', () => {
  assert.equal(canTransition('pending', 'processing').ok, true)
  assert.equal(canTransition('pending', 'closed').ok, false)
})

test('processing 可退回 pending，也可闭环', () => {
  assert.equal(canTransition('processing', 'pending').ok, true)
  assert.equal(canTransition('processing', 'closed').ok, true)
})

test('closed 是终态：任何迁出都被拒绝', () => {
  Object.keys(STATUS_META).forEach((to) => {
    const r = canTransition('closed', to)
    assert.equal(r.ok, false, `closed→${to} 不应被允许`)
    assert.match(r.message, /已闭环/)
  })
})

test('同状态流转无意义，恒为 false', () => {
  Object.keys(STATUS_META).forEach((s) => {
    assert.equal(canTransition(s, s).ok, false)
    assert.match(canTransition(s, s).message, /已处于/)
  })
})

test('非法状态给出可读错误信息，而不是抛异常', () => {
  assert.match(canTransition('pending', 'deleted').message, /目标状态非法/)
  assert.match(canTransition('unknown', 'closed').message, /当前状态非法/)
})

test('非法流转的错误文案要讲人话（指出从哪到哪不被允许）', () => {
  const r = canTransition('pending', 'closed')
  assert.ok(r.message.includes('待处置') && r.message.includes('已闭环'))
})

test('statusLabel：未知状态原样返回，不返回 undefined', () => {
  assert.equal(statusLabel('pending'), '待处置')
  assert.equal(statusLabel('processing'), '处置中')
  assert.equal(statusLabel('closed'), '已闭环')
  assert.equal(statusLabel('weird'), 'weird')
})

test('statusList：按业务顺序返回（待处置→处置中→已闭环）', () => {
  assert.deepEqual(statusList().map((s) => s.key), ['pending', 'processing', 'closed'])
})

test('常量与前端 ESM 镜像的键保持一致（防止改一侧忘另一侧）', () => {
  assert.deepEqual(Object.keys(TICKET_STATUS).sort(), ['CLOSED', 'PENDING', 'PROCESSING'])
  assert.deepEqual(Object.keys(STATUS_META).sort(), ['closed', 'pending', 'processing'])
})
