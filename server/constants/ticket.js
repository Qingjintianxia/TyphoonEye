'use strict'

/**
 * 工单状态机
 *
 * 单一来源：后端路由、单元测试、前端展示共用同一套语义，
 * 避免"后端允许的状态前端显示不出来"这类不一致。
 */

const TICKET_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  CLOSED: 'closed'
}

const STATUS_META = {
  pending: { key: 'pending', label: '待处置', badge: 'badge-blue', order: 1 },
  processing: { key: 'processing', label: '处置中', badge: 'badge-yellow', order: 2 },
  closed: { key: 'closed', label: '已闭环', badge: 'badge-green', order: 3 }
}

/**
 * 合法状态转移表。
 * closed 为终态：不允许再改状态（但仍可追加处置意见，复盘补充是真实需求）。
 */
const ALLOWED_TRANSITIONS = {
  pending: ['processing'],
  processing: ['pending', 'closed'],
  closed: []
}

/** 时间线条目类型 */
const TIMELINE_TYPES = {
  CREATE: 'create',
  STATUS: 'status',
  COMMENT: 'comment'
}

function isStatus(value) {
  return Object.prototype.hasOwnProperty.call(STATUS_META, value)
}

/**
 * 校验状态流转是否合法（纯函数，可单测）
 * @returns {{ok:boolean, message?:string}}
 */
function canTransition(from, to) {
  if (!isStatus(to)) return { ok: false, message: `目标状态非法：${to}` }
  if (!isStatus(from)) return { ok: false, message: `当前状态非法：${from}` }
  if (from === to) return { ok: false, message: `工单已处于「${STATUS_META[to].label}」` }

  const allowed = ALLOWED_TRANSITIONS[from] || []
  if (!allowed.includes(to)) {
    const fromLabel = STATUS_META[from].label
    const toLabel = STATUS_META[to].label
    // 终态单独给一句人话提示，比"不允许"更有用
    if (from === TICKET_STATUS.CLOSED) {
      return { ok: false, message: '工单已闭环，不可再变更状态（仍可补充处置意见）' }
    }
    return { ok: false, message: `不允许从「${fromLabel}」直接变更为「${toLabel}」` }
  }
  return { ok: true }
}

function statusLabel(status) {
  return STATUS_META[status] ? STATUS_META[status].label : status || '—'
}

function statusList() {
  return Object.values(STATUS_META).sort((a, b) => a.order - b.order)
}

module.exports = {
  TICKET_STATUS,
  STATUS_META,
  ALLOWED_TRANSITIONS,
  TIMELINE_TYPES,
  isStatus,
  canTransition,
  statusLabel,
  statusList
}
