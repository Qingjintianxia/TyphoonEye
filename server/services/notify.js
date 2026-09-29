'use strict'

/**
 * 消息中心服务
 *
 * 职责：把"发生了什么"翻译成"该告诉谁"。
 * 工单模块只负责业务动作，通知归这里管 —— 职责分离，互不污染。
 */

const jsonStore = require('../lib/jsonStore')
const dataPath = require('../lib/dataPath')

const NOTIFICATIONS_FILE = dataPath('notifications.json')

/** 通知类型 */
const NOTIFY_TYPES = {
  TICKET_CREATED: 'ticket_created',
  TICKET_STATUS: 'ticket_status',
  TICKET_COMMENT: 'ticket_comment',
  ALERT_DISPATCH: 'alert_dispatch'
}

const TYPE_LABEL = {
  ticket_created: '新工单',
  ticket_status: '状态变更',
  ticket_comment: '处置意见',
  alert_dispatch: '预警推送'
}

function newId() {
  return `NOT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 生成通知。
 *
 * @param {object} payload
 * @param {string} payload.type NOTIFY_TYPES 之一
 * @param {string} payload.title
 * @param {string} payload.content
 * @param {string} [payload.level] 预警四色，用于前端配色
 * @param {string} [payload.refType] ticket | alert
 * @param {string} [payload.refId]
 * @param {string} [payload.actor] 触发者（自己触发的事件不会通知自己）
 * @param {string|null} [payload.userId] 接收者；null 表示全体广播
 * @returns {Promise<object|null>} 写入的通知；无接收者时返回 null
 */
async function push(payload) {
  const userId = payload.userId === undefined ? null : payload.userId
  // 自己触发的事件不发给自己 —— 否则用户会被自己的操作刷屏
  if (userId && payload.actor && userId === payload.actor) return null

  const notification = {
    id: newId(),
    type: payload.type,
    typeLabel: TYPE_LABEL[payload.type] || payload.type,
    title: payload.title,
    content: payload.content || '',
    level: payload.level || 'blue',
    refType: payload.refType || '',
    refId: payload.refId || '',
    actor: payload.actor || '',
    userId,
    readBy: [],
    createdAt: new Date().toISOString()
  }

  await jsonStore.mutate(NOTIFICATIONS_FILE, (list) => [...list, notification])
  return notification
}

/**
 * 业务侧调用的非阻断版本：通知写失败只告警，绝不让工单主流程回滚。
 * 工单已经流转成功却因通知失败而报错，是本末倒置。
 */
async function pushSafe(payload) {
  try {
    return await push(payload)
  } catch (e) {
    console.warn('[notify] 通知写入失败，业务主流程不受影响：', e.message)
    return null
  }
}

/** 该用户能否看见这条通知（自己的 或 广播） */
function isVisible(notification, username) {
  if (!notification) return false
  return notification.userId === null || notification.userId === username
}

/** 是否已读（广播消息按人记录，故用 readBy 数组而非布尔） */
function isRead(notification, username) {
  return Array.isArray(notification.readBy) && notification.readBy.includes(username)
}

/** 未读数 */
function unreadCount(list, username) {
  return (list || []).filter((n) => isVisible(n, username) && !isRead(n, username)).length
}

module.exports = {
  NOTIFY_TYPES,
  TYPE_LABEL,
  NOTIFICATIONS_FILE,
  push,
  pushSafe,
  isVisible,
  isRead,
  unreadCount
}
