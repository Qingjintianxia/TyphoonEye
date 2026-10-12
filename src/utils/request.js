/**
 * 统一请求层
 *
 * 职责：
 * - 注入鉴权头、超时控制、错误解包
 * - 401 全局处理（清 token + 跳登录 + 提示），并发请求只触发一次
 * - 网络异常转为用户可读文案
 *
 * 业务代码不使用裸 fetch。
 */
import { toast } from './toast'

const BASE_URL = '/api'
const TOKEN_KEY = 'token'
const DEFAULT_TIMEOUT = 15000

/** 自定义错误类型，便于调用方区分业务错误与网络错误 */
export class ApiError extends Error {
  constructor(message, { code = -1, status = 0, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.cause = cause
  }
  /** 鉴权失败（未登录或已过期） */
  get isUnauthorized() {
    return this.status === 401 || this.code === 401
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 隐私模式下 localStorage 不可用，忽略 */
  }
  unauthorizedHandled = false
}

let unauthorizedHandled = false

async function redirectToLogin() {
  try {
    const { default: router } = await import('../router')
    const current = router.currentRoute?.value
    // 已在登录/注册页则不重复跳转
    if (current?.meta?.guest) return
    router.push({ path: '/login', query: { redirect: current?.fullPath || '' } })
  } catch {
    /* 路由未就绪时不做跳转 */
  }
}

function buildURL(path, params) {
  const url = path.startsWith('/') ? path : `/${path}`
  let qs = ''
  if (params && Object.keys(params).length) {
    const usp = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') usp.append(k, String(v))
    })
    qs = usp.toString()
  }
  return `${BASE_URL}${url}${qs ? `?${qs}` : ''}`
}

function friendlyNetworkMessage(err) {
  if (err?.name === 'AbortError') return '请求超时，请检查网络后重试'
  return '网络连接失败，请检查服务是否正常运行'
}

/**
 * 核心请求方法
 * @param {string} method
 * @param {string} path 不含 /api 前缀的路径，如 '/typhoons'
 * @param {object} options { params, body, signal, timeout, silent, raw }
 * @returns {Promise<any>} 解包后的 data；raw=true 时返回完整响应体
 */
async function request(method, path, options = {}) {
  const { params, body, signal, timeout = DEFAULT_TIMEOUT, silent = false, raw = false } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  // 外部取消信号与内部超时信号联动
  const onAbort = () => controller.abort()
  signal?.addEventListener?.('abort', onAbort)

  const headers = { Accept: 'application/json' }
  const token = getToken()
  // 记录"本次请求是否携带 token"：401 时据此区分"从未登录"与"登录已过期"。
  // 不重新取 getToken()，该值可能在请求飞行途中已被清空
  const hadToken = !!token
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    const res = await fetch(buildURL(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    })

    // 401 统一处理，并发请求只提示一次
    if (res.status === 401) {
      // 本次请求没带 token（未登录或抢跑请求）时不提示，
      // 登录跳转由路由守卫负责
      if (!hadToken) {
        throw new ApiError('未登录', { code: 401, status: 401 })
      }
      if (!unauthorizedHandled) {
        unauthorizedHandled = true
        setToken('')
        if (!silent) toast.error('登录已过期，请重新登录')
        await redirectToLogin()
      }
      throw new ApiError('登录已过期', { code: 401, status: 401 })
    }

    let json
    try {
      json = await res.json()
    } catch {
      throw new ApiError('服务端返回了无法解析的内容', { status: res.status })
    }

    if (!res.ok) {
      const err = new ApiError(json?.message || `请求失败（${res.status}）`, {
        code: json?.code ?? res.status,
        status: res.status
      })
      if (!silent) toast.error(err.message)
      throw err
    }

    // 后端统一包 { code, data, message }；code !== 200 视为业务失败
    if (!raw) {
      if (json?.code !== undefined && json.code !== 200) {
        const err = new ApiError(json.message || '操作失败', { code: json.code, status: res.status })
        if (!silent) toast.error(err.message)
        throw err
      }
      return json?.data
    }
    return json
  } catch (err) {
    if (err instanceof ApiError) throw err
    const apiErr = new ApiError(friendlyNetworkMessage(err), { code: -1, status: 0, cause: err })
    if (!silent) toast.error(apiErr.message)
    throw apiErr
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener?.('abort', onAbort)
  }
}

export const http = {
  get: (path, params, options) => request('GET', path, { ...options, params }),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  del: (path, options) => request('DELETE', path, options),
  /** 返回原始响应体，不参与统一解包与 toast */
  raw: (method, path, options) => request(method, path, { ...options, raw: true })
}

export default http

/**
 * catch 块中的错误处理。401 与网络错误已在 request 层提示过，此处默认不再弹窗。
 */
export function handleError(err, fallback = '操作失败，请稍后重试') {
  if (err instanceof ApiError) {
    if (err.isUnauthorized) return err.message
    return err.message || fallback
  }
  console.error('[request] 未预期的错误：', err)
  return fallback
}
