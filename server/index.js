'use strict'

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const config = require('./config')
const { authMiddleware } = require('./middleware/auth')
const errorHandler = require('./middleware/errorHandler')

const app = express()

// 安全响应头（HSTS / CSP / NoSniff 等）；API 无内联脚本，默认策略即可。
app.use(helmet())

// CORS 白名单：仅允许显式配置的前端来源，不再全开
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}))

app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/typhoons', authMiddleware, require('./routes/typhoons'))
app.use('/api/alerts', authMiddleware, require('./routes/alerts'))
app.use('/api/statistics', authMiddleware, require('./routes/statistics'))
app.use('/api/tickets', authMiddleware, require('./routes/tickets'))
app.use('/api/notifications', authMiddleware, require('./routes/notifications'))

// 无匹配路由 → 统一 JSON 404
app.use(errorHandler.notFound)

// 统一错误处理（必须在所有路由之后）
app.use(errorHandler.handler)

app.listen(config.port, () => {
  console.log(`Typhoon Warning System API running at http://localhost:${config.port}`)
})
