'use strict'

/**
 * 统一错误处理中间件。
 * 捕获路由内同步/异步抛出的异常，返回统一 JSON 错误体。
 * 生产环境不向客户端泄露堆栈。
 *
 * 注意：Express 要求该签名必须是 4 参数 (err, req, res, next)，
 * 且必须在所有路由之后注册。
 */
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500
  if (status >= 500) {
    console.error('[server] 未处理异常：', err && err.stack ? err.stack : err)
  }
  res.status(status).json({
    code: status,
    message: status >= 500 ? '服务器内部错误' : (err && err.message) || '请求处理失败'
  })
}

/** 兜底 404：无匹配的 API 路由时返回 JSON（避免 Express 默认 HTML） */
function notFoundHandler(req, res) {
  res.status(404).json({ code: 404, message: '接口不存在' })
}

module.exports = errorHandler
module.exports.handler = errorHandler
module.exports.notFound = notFoundHandler
