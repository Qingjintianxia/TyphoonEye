'use strict'

/**
 * 后端全链路功能测试
 *
 * 特点：
 * - 自带环境变量起服务（独立端口 3101 + 临时 DATA_DIR），不依赖外部已启动的实例，
 * 也不会在 server/data/ 留下测试工单与消息。
 * - 等待就绪用轮询而非固定 sleep（服务启动耗时随机器负载波动）。
 * - 覆盖：鉴权 → 预警 → 推送 → 工单生命周期 → 消息中心 → 跨用户已读隔离。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const PORT = 3101
const BASE = `http://127.0.0.1:${PORT}/api`
const SERVER = path.join(__dirname, '..', '..', 'server', 'index.js')

let child
let dataDir

/** 统一请求：返回 { status, body }，不自动抛错，便于断言业务错误码 */
async function req(method, url, { token, body } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  let json = null
  try { json = await res.json() } catch { /* 非 JSON 响应 */ }
  return { status: res.status, body: json }
}

const get = (url, token) => req('GET', url, { token })
const post = (url, body, token) => req('POST', url, { token, body })
const patch = (url, body, token) => req('PATCH', url, { token, body })

/** 轮询直到服务可用，超时则失败 */
async function waitReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/nope`)
      if (res.status) return true
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error('服务在超时时间内未就绪')
}

function uniqueUser(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'typhoon-api-'))
  child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      JWT_SECRET: 'unit-test-secret-do-not-use-in-prod',
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://127.0.0.1:3101',
      // 限流阈值必须在测试环境放宽：全链路用例会连续注册/登录十余次，
      // 否则后半段用例会被登录限流挡成 429（不是逻辑问题，是配额问题）。
      LOGIN_LIMIT_MAX: '1000',
      REGISTER_LIMIT_MAX: '1000'
    },
    stdio: 'ignore'
  })
  await waitReady()
})

test.after(() => {
  if (child && !child.killed) child.kill()
  try {
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true })
  } catch { /* 临时目录清理失败不影响测试结果 */ }
})

test('未知路径返回 JSON 404，而不是 HTML', async () => {
  const { status, body } = await get('/nope')
  assert.equal(status, 404)
  assert.equal(body.code, 404)
})

test('未带 token 访问受保护接口被拒绝', async () => {
  const { status } = await get('/tickets')
  assert.equal(status, 401)
})

test('注册 → 登录 → /auth/me → /auth/users 全链路', async () => {
  const username = uniqueUser('apitest')
  const password = 'pass123456'

  let r = await post('/auth/register', { username, password, email: 'a@b.c' })
  assert.equal(r.body.code, 200)
  assert.ok(r.body.data.token)

  r = await post('/auth/login', { username, password })
  assert.equal(r.body.code, 200)
  const token = r.body.data.token
  assert.ok(token, '登录应返回 token')

  r = await get('/auth/me', token)
  assert.equal(r.body.code, 200)
  assert.equal(r.body.data.username, username)
  // 不下发密码哈希
  assert.equal(r.body.data.password, undefined)

  r = await get('/auth/users', token)
  assert.equal(r.body.code, 200)
  assert.ok(Array.isArray(r.body.data))
  r.body.data.forEach((u) => assert.equal(u.password, undefined))
})

test('弱密码与重复用户名被拒绝', async () => {
  const username = uniqueUser('weakpw')
  let r = await post('/auth/register', { username, password: '123' })
  assert.equal(r.body.code, 400)

  await post('/auth/register', { username, password: 'pass123456' })
  r = await post('/auth/register', { username, password: 'pass123456' })
  assert.equal(r.body.code, 400)
  assert.match(r.body.message, /用户名已存在/)
})

test('登录错误文案统一，不暴露用户名是否存在', async () => {
  const a = await post('/auth/login', { username: 'no-such-user-xyz', password: 'whatever1' })
  const b = await post('/auth/login', { username: uniqueUser('x'), password: 'wrong-pass' })
  assert.equal(a.body.message, b.body.message)
  assert.equal(a.body.code, 400)
})

test('预警列表返回 breakdown 分项（人工 / 规则派生）', async () => {
  const u = uniqueUser('alert')
  await post('/auth/register', { username: u, password: 'pass123456' })
  const login = await post('/auth/login', { username: u, password: 'pass123456' })
  const token = login.body.data.token

  const r = await get('/alerts', token)
  assert.equal(r.body.code, 200)
  assert.ok(Array.isArray(r.body.data))
  assert.ok(r.body.breakdown, '缺少 breakdown')
  assert.ok(r.body.breakdown.manual > 0, '应含人工发布预警')
  assert.ok(r.body.breakdown.rule > 0, '应含规则派生预警')

  // 每条预警都必须能区分来源，这是"机器结论不可伪装成人工研判"的底线
  r.body.data.forEach((a) => assert.ok(['manual', 'rule'].includes(a.source)))
})

test('规则派生预警可被 source 过滤且 ID 结构稳定', async () => {
  const u = uniqueUser('rules')
  await post('/auth/register', { username: u, password: 'pass123456' })
  const token = (await post('/auth/login', { username: u, password: 'pass123456' })).body.data.token

  const rules = await get('/alerts/rules', token)
  assert.equal(rules.body.code, 200)
  assert.equal(rules.body.data.length, 5)

  const derived = await get('/alerts?source=rule', token)
  derived.body.data.forEach((a) => {
    assert.equal(a.source, 'rule')
    assert.match(a.id, /^RULE-.+-.+-.+$/)
  })
})

test('工单完整生命周期：建单 → 流转 → 意见 → 统计', async () => {
  const owner = uniqueUser('owner')
  const handler = uniqueUser('handler')
  await post('/auth/register', { username: owner, password: 'pass123456' })
  await post('/auth/register', { username: handler, password: 'pass123456' })
  const token = (await post('/auth/login', { username: owner, password: 'pass123456' })).body.data.token

  const alertsRes = await get('/alerts?source=rule', token)
  const alert = alertsRes.body.data[0]
  assert.ok(alert, '规则派生预警不应为空')

  // 1) 建单
  let r = await post('/tickets', { alertId: alert.id, typhoonId: alert.typhoonId, title: 'API 测试工单', assignee: handler }, token)
  assert.equal(r.body.code, 200)
  const ticket = r.body.data
  assert.equal(ticket.status, 'pending')
  assert.equal(ticket.assignee, handler)
  assert.equal(ticket.timeline.length, 1)

  // 2) 重复建单必须被拒
  r = await post('/tickets', { alertId: alert.id, typhoonId: alert.typhoonId, title: '重复工单' }, token)
  assert.equal(r.body.code, 400)
  assert.match(r.body.message, /已有未闭环工单/)

  // 3) 非法流转：pending → closed
  r = await patch(`/tickets/${ticket.id}/status`, { status: 'closed' }, token)
  assert.equal(r.body.code, 400)
  assert.match(r.body.message, /不允许从「待处置」直接变更为「已闭环」/)

  // 4) 合法流转 pending → processing → closed
  r = await patch(`/tickets/${ticket.id}/status`, { status: 'processing', note: '开始处置' }, token)
  assert.equal(r.body.code, 200)
  assert.equal(r.body.data.status, 'processing')
  assert.equal(r.body.data.timeline.length, 2)

  r = await patch(`/tickets/${ticket.id}/status`, { status: 'closed' }, token)
  assert.equal(r.body.code, 200)
  assert.equal(r.body.data.status, 'closed')
  assert.equal(r.body.data.timeline.length, 3)

  // 5) 终态不可再流转
  r = await patch(`/tickets/${ticket.id}/status`, { status: 'pending' }, token)
  assert.equal(r.body.code, 400)
  assert.match(r.body.message, /已闭环/)

  // 6) 闭环后仍可补充处置意见
  r = await post(`/tickets/${ticket.id}/comments`, { content: '复盘：处置及时' }, token)
  assert.equal(r.body.code, 200)
  assert.equal(r.body.data.timeline.length, 4)

  // 7) 空意见被拒
  r = await post(`/tickets/${ticket.id}/comments`, { content: '   ' }, token)
  assert.equal(r.body.code, 400)

  // 8) 统计
  r = await get('/tickets/stats', token)
  assert.equal(r.body.code, 200)
  assert.ok(r.body.data.total >= 1)
  assert.equal(typeof r.body.data.closedRate, 'number')
})

test('工单列表支持筛选，且操作人取自 token 而非请求体', async () => {
  const u = uniqueUser('filter')
  await post('/auth/register', { username: u, password: 'pass123456' })
  const token = (await post('/auth/login', { username: u, password: 'pass123456' })).body.data.token

  const alertsRes = await get('/alerts?source=rule', token)
  const alert = alertsRes.body.data[1] || alertsRes.body.data[0]

  const created = await post('/tickets', { alertId: alert.id, typhoonId: alert.typhoonId, title: '筛选测试' }, token)
  const id = created.body.data.id
  assert.equal(created.body.data.createdBy, u, '操作人必须是 token 中的用户')

  const byTyphoon = await get(`/tickets?typhoonId=${encodeURIComponent(alert.typhoonId)}`, token)
  assert.ok(byTyphoon.body.data.some((t) => t.id === id))

  const byStatus = await get('/tickets?status=pending', token)
  assert.ok(byStatus.body.data.every((t) => t.status === 'pending'))
})

test('不存在的工单返回 404', async () => {
  const u = uniqueUser('nf')
  await post('/auth/register', { username: u, password: 'pass123456' })
  const token = (await post('/auth/login', { username: u, password: 'pass123456' })).body.data.token
  const r = await get('/tickets/NOPE-404', token)
  assert.equal(r.body.code, 404)
})

test('预警推送：空选择被拒，正常推送返回条数', async () => {
  const u = uniqueUser('dispatch')
  await post('/auth/register', { username: u, password: 'pass123456' })
  const token = (await post('/auth/login', { username: u, password: 'pass123456' })).body.data.token

  let r = await post('/alerts/dispatch', { alertIds: [] }, token)
  assert.equal(r.body.code, 400)

  const alertsRes = await get('/alerts', token)
  const ids = alertsRes.body.data.slice(0, 2).map((a) => a.id)
  r = await post('/alerts/dispatch', { alertIds: ids }, token)
  assert.equal(r.body.code, 200)
  assert.equal(r.body.data.total, 2)
  assert.equal(r.body.data.sent, 2)
})

test('消息中心：未读数、单条已读、全部已读', async () => {
  const u = uniqueUser('notify')
  await post('/auth/register', { username: u, password: 'pass123456' })
  const token = (await post('/auth/login', { username: u, password: 'pass123456' })).body.data.token

  // 广播一条给自己
  const alertsRes = await get('/alerts', token)
  await post('/alerts/dispatch', { alertIds: [alertsRes.body.data[0].id] }, token)

  let r = await get('/notifications', token)
  assert.equal(r.body.code, 200)
  assert.ok(r.body.data.length >= 1)
  assert.ok(r.body.unread >= 1)

  const first = r.body.data[0]
  r = await patch(`/notifications/${first.id}/read`, {}, token)
  assert.equal(r.body.code, 200)

  r = await get('/notifications/unread-count', token)
  const afterOne = r.body.data.unread

  r = await post('/notifications/read-all', {}, token)
  assert.equal(r.body.code, 200)
  assert.equal(r.body.data.updated, afterOne, '全部已读应正好处理剩余未读')

  r = await get('/notifications/unread-count', token)
  assert.equal(r.body.data.unread, 0)
})

test('跨用户已读隔离：A 全部已读不影响 B 的未读数', async () => {
  const a = uniqueUser('isoa')
  const b = uniqueUser('isob')
  await post('/auth/register', { username: a, password: 'pass123456' })
  await post('/auth/register', { username: b, password: 'pass123456' })
  const tokenA = (await post('/auth/login', { username: a, password: 'pass123456' })).body.data.token
  const tokenB = (await post('/auth/login', { username: b, password: 'pass123456' })).body.data.token

  // A 发一条广播，两人都能看到
  const alertsRes = await get('/alerts', tokenA)
  await post('/alerts/dispatch', { alertIds: [alertsRes.body.data[0].id] }, tokenA)

  const beforeB = (await get('/notifications/unread-count', tokenB)).body.data.unread
  assert.ok(beforeB >= 1, 'B 应看到广播消息')

  await post('/notifications/read-all', {}, tokenA)

  const afterB = (await get('/notifications/unread-count', tokenB)).body.data.unread
  assert.equal(afterB, beforeB, 'A 的已读操作不应影响 B 的未读数')
})

test('自己触发的事件不会通知自己', async () => {
  const u = uniqueUser('self')
  await post('/auth/register', { username: u, password: 'pass123456' })
  const token = (await post('/auth/login', { username: u, password: 'pass123456' })).body.data.token

  const before = (await get('/notifications/unread-count', token)).body.data.unread

  const alertsRes = await get('/alerts?source=rule', token)
  const alert = alertsRes.body.data[2] || alertsRes.body.data[0]
  // 建单并指派给自己 → 不应给自己发通知
  await post('/tickets', { alertId: alert.id, typhoonId: alert.typhoonId, title: '自指派工单', assignee: u }, token)

  const after = (await get('/notifications/unread-count', token)).body.data.unread
  assert.equal(after, before)
})
