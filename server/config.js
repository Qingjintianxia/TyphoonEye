'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

/**
 * 集中配置：密钥、端口、CORS、限流等环境相关量从 process.env 读取。
 * 无 dotenv 依赖，自带极简 .env 解析。
 */

// 极简 .env 解析：存在则读取并补全未设置的变量，缺省或解析失败不阻断启动
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env')
  try {
    if (!fs.existsSync(envPath)) return
    const text = fs.readFileSync(envPath, 'utf-8')
    text.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const idx = trimmed.indexOf('=')
      if (idx === -1) return
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (process.env[key] === undefined) process.env[key] = value
    })
  } catch (e) {
    console.warn('[config] 读取 .env 失败：', e.message)
  }
}

loadEnvFile()

const isProd = process.env.NODE_ENV === 'production'

/**
 * 生产环境缺少 JWT_SECRET 时直接退出，不使用默认密钥；
 * 开发环境缺失则生成一次性随机密钥并告警，重启即失效。
 */
function resolveJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  if (isProd) {
    console.error('[FATAL] 生产环境缺少 JWT_SECRET，拒绝以默认密钥启动。请在环境变量中配置。')
    process.exit(1)
  }
  const ephemeral = crypto.randomBytes(32).toString('hex')
  console.warn('[config] 未设置 JWT_SECRET，已生成一次性随机密钥（重启即失效），仅可用于本地开发。')
  return ephemeral
}

function resolveCorsOrigins() {
  const raw = process.env.CORS_ORIGINS
  if (raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return ['http://localhost:5173', 'http://127.0.0.1:5173']
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  // 数据目录可被 DATA_DIR 覆盖：功能测试用它隔离演示数据
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: resolveCorsOrigins(),
  loginRateLimit: {
    windowMs: Number(process.env.LOGIN_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.LOGIN_LIMIT_MAX) || 10
  },
  registerRateLimit: {
    windowMs: Number(process.env.REGISTER_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
    max: Number(process.env.REGISTER_LIMIT_MAX) || 20
  }
}
