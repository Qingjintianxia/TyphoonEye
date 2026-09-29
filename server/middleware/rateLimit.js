'use strict'

const rateLimit = require('express-rate-limit')
const config = require('../config')

/**
 * 登录限流：防暴力破解。每 IP 在窗口内超过阈值返回 429 + 统一错误体。
 */
const loginLimiter = rateLimit({
  windowMs: config.loginRateLimit.windowMs,
  max: config.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ code: 429, message: '登录尝试过于频繁，请稍后再试' })
})

/**
 * 注册限流：防批量撞库/刷号。阈值略宽。
 */
const registerLimiter = rateLimit({
  windowMs: config.registerRateLimit.windowMs,
  max: config.registerRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ code: 429, message: '注册过于频繁，请稍后再试' })
})

module.exports = { loginLimiter, registerLimiter }
