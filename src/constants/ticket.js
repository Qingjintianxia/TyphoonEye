/**
 * 工单与预警来源常量
 *
 * 本文件是 `server/constants/ticket.js` 的 ESM 镜像，改一侧需同步另一侧。
 *
 * 这里只负责 label / badge / 可流转目标，不做业务裁决。
 * 状态流转以后端 canTransition() 为准，前端禁用按钮只是体验优化。
 */

export const TICKET_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  CLOSED: 'closed'
}

/** 状态 → 展示元信息。order 用于排序与筛选器顺序 */
export const STATUS_META = {
  pending: { key: 'pending', label: '待处置', badge: 'badge-blue', order: 1 },
  processing: { key: 'processing', label: '处置中', badge: 'badge-yellow', order: 2 },
  closed: { key: 'closed', label: '已闭环', badge: 'badge-green', order: 3 }
}

/**
 * 合法状态转移表（必须与后端 ALLOWED_TRANSITIONS 一致）。
 * closed 为终态：不可再改状态，但仍可追加处置意见。
 */
export const ALLOWED_TRANSITIONS = {
  pending: ['processing'],
  processing: ['pending', 'closed'],
  closed: []
}

/** 时间线条目类型 */
export const TIMELINE_TYPES = {
  CREATE: 'create',
  STATUS: 'status',
  COMMENT: 'comment'
}

export const TIMELINE_META = {
  create: { label: '建单', badge: 'badge-blue' },
  status: { label: '状态变更', badge: 'badge-yellow' },
  comment: { label: '处置意见', badge: 'badge-green' }
}

/**
 * 预警来源：自动派生的结论必须让用户知道它是程序算出来的，
 * 不能伪装成人工研判。
 */
export const ALERT_SOURCES = {
  manual: { key: 'manual', label: '人工发布', badge: 'badge-blue' },
  rule: { key: 'rule', label: '规则派生', badge: 'badge-yellow' }
}

/** 消息类型 → 展示文案（后端 notify.NOTIFY_TYPES 的展示镜像） */
export const NOTIFY_TYPE_META = {
  ticket_created: { label: '新工单', badge: 'badge-blue' },
  ticket_status: { label: '状态变更', badge: 'badge-yellow' },
  ticket_comment: { label: '处置意见', badge: 'badge-green' },
  alert_dispatch: { label: '预警推送', badge: 'badge-red' }
}

export function isStatus(value) {
  return Object.prototype.hasOwnProperty.call(STATUS_META, value)
}

export function statusMeta(status) {
  return STATUS_META[status] || { key: status, label: status || '未知', badge: 'badge-blue', order: 99 }
}

export function statusLabel(status) {
  return statusMeta(status).label
}

export function statusBadge(status) {
  return statusMeta(status).badge
}

/** 筛选器与统计卡片的顺序列表 */
export function statusList() {
  return Object.values(STATUS_META).sort((a, b) => a.order - b.order)
}

/**
 * 当前状态允许流转到的目标状态列表。
 * UI 只渲染这些按钮，非法目标不出现
 */
export function nextStatuses(status) {
  return ALLOWED_TRANSITIONS[status] || []
}

export function timelineMeta(type) {
  return TIMELINE_META[type] || { label: type || '记录', badge: 'badge-blue' }
}

export function alertSourceMeta(source) {
  return ALERT_SOURCES[source] || { key: source || 'unknown', label: source || '未知来源', badge: 'badge-blue' }
}

export function notifyTypeMeta(type) {
  return NOTIFY_TYPE_META[type] || { label: type || '通知', badge: 'badge-blue' }
}
