'use strict'

const jwt = require('jsonwebtoken')
const config = require('../config')

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '请先登录' })
  }
  const token = header.split(' ')[1]
  if (!token) {
    return res.status(401).json({ code: 401, message: '请先登录' })
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' })
  }
}

module.exports = { authMiddleware }
