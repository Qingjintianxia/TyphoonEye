'use strict'

const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const config = require('../config')
const { authMiddleware } = require('../middleware/auth')
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit')
const jsonStore = require('../lib/jsonStore')
const dataPath = require('../lib/dataPath')

const router = express.Router()
const USERS_FILE = dataPath('users.json')

// 文件不存在或解析失败时按空用户表处理
const readUsers = () => jsonStore.read(USERS_FILE, [])

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  )
}

function stripPassword(user) {
  const { password: _pw, ...rest } = user
  return rest
}

// 异步路由错误转发到统一错误处理中间件
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

async function handleRegister(req, res) {
  const { username, password, email } = req.body
  if (!username || username.length < 3) {
    return res.json({ code: 400, message: '用户名至少3个字符' })
  }
  if (!password || password.length < 6) {
    return res.json({ code: 400, message: '密码至少6个字符' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const newUser = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    username,
    email: email || '',
    password: hashedPassword,
    createdAt: new Date().toISOString()
  }

  // 校验与写入都在锁内，并发注册不会产生重复用户名
  try {
    await jsonStore.mutate(USERS_FILE, (current) => {
      if (current.find((u) => u.username === username)) {
        const err = new Error('用户名已存在')
        err.status = 400
        err.conflict = true
        throw err
      }
      return [...current, newUser]
    })
  } catch (e) {
    if (e && e.conflict) return res.json({ code: 400, message: e.message })
    throw e
  }

  const token = generateToken(newUser)
  res.json({ code: 200, data: { user: stripPassword(newUser), token }, message: '注册成功' })
}

async function handleLogin(req, res) {
  const { username, password } = req.body
  if (!username || !password) {
    return res.json({ code: 400, message: '请输入用户名和密码' })
  }

  const users = readUsers()
  const user = users.find((u) => u.username === username)
  // 用户名不存在与密码错误返回同一文案
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.json({ code: 400, message: '用户名或密码错误' })
  }

  const token = generateToken(user)
  res.json({ code: 200, data: { user: stripPassword(user), token }, message: '登录成功' })
}

router.post('/register', registerLimiter, wrap(handleRegister))
router.post('/login', loginLimiter, wrap(handleLogin))

router.get('/me', authMiddleware, (req, res) => {
  const users = readUsers()
  const user = users.find((u) => u.id === req.user.id)
  if (!user) {
    return res.json({ code: 404, message: '用户不存在' })
  }
  res.json({ code: 200, data: stripPassword(user) })
})

/** 用户候选：工单负责人下拉用，只暴露 username 与 email */
router.get('/users', authMiddleware, (req, res) => {
  const list = readUsers().map((u) => ({ id: u.id, username: u.username, email: u.email || '' }))
  res.json({ code: 200, data: list, total: list.length })
})

module.exports = router
