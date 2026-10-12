/**
 * JWT 客户端解析工具
 *
 * 路由守卫在放行前判断 token 是否过期。这里不校验签名，
 * 真正的鉴权由 server/middleware/auth.js 完成。
 */
import { getToken } from './request'

/** 解析 JWT payload，失败返回 null */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    // base64url → base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** token 过期时间戳（毫秒），无 exp 或解析失败返回 null */
export function tokenExpiresAt(token) {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return null
  return payload.exp * 1000
}

/**
 * token 是否可用（存在且未过期）
 * 提前 30 秒判定为过期，规避客户端与服务端时钟误差。
 */
export function isTokenValid(token = getToken(), skewSeconds = 30) {
  if (!token) return false
  const expiresAt = tokenExpiresAt(token)
  if (expiresAt === null) return false
  return Date.now() < expiresAt - skewSeconds * 1000
}

/** token 中的用户信息（用于守卫阶段预填，不依赖 /me 接口） */
export function tokenUser(token = getToken()) {
  const payload = decodeJwtPayload(token)
  if (!payload) return null
  return { id: payload.id, username: payload.username, email: payload.email }
}
