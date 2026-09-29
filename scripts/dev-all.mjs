/**
 * 一键启动前后端（零依赖）
 *
 * 用法：node scripts/dev-all.mjs （或 npm run dev:all）
 *
 * 为什么要这个脚本：
 * 1. 只起前端会导致所有 /api 请求 401，两个服务必须同时起来；
 * 2. 后端必须先就绪，否则前端首屏数据全空；
 * 3. 单 Ctrl+C 要能同时收掉两个进程，避免留下占用 3000/5173 的僵尸进程。
 *
 * 约定：
 * - 子进程 stdout/stderr 原样透传并加前缀，便于区分来源；
 * - 收到 SIGINT/SIGTERM/exit 时统一回收子进程；
 * - 不做自动重启：崩溃要让用户看见，而不是被静默拉起。
 */
import { spawn } from 'node:child_process'
import process from 'node:process'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const NODE = process.execPath

const SERVICES = [
  {
    name: 'backend',
    color: '\x1b[36m', // cyan
    cmd: NODE,
    args: ['server/index.js'],
    url: 'http://localhost:3000'
  },
  {
    name: 'frontend',
    color: '\x1b[35m', // magenta
    cmd: NODE,
    args: ['node_modules/vite/bin/vite.js'],
    url: 'http://localhost:5173'
  }
]

const RESET = '\x1b[0m'
const children = []
let closing = false

function prefixLines(name, color, chunk) {
  const text = chunk.toString().trimEnd()
  if (!text) return
  text.split(/\r?\n/).forEach((line) => {
    process.stdout.write(`${color}[${name}]${RESET} ${line}\n`)
  })
}

function shutdown(code = 0) {
  if (closing) return
  closing = true
  children.forEach((c) => {
    if (!c.killed) {
      // Windows 上 node 子进程不响应 SIGTERM，直接 kill
      try { c.kill() } catch { /* 已退出 */ }
    }
  })
  process.exit(code)
}

SERVICES.forEach((svc) => {
  const child = spawn(svc.cmd, svc.args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  })
  children.push(child)

  child.stdout.on('data', (c) => prefixLines(svc.name, svc.color, c))
  child.stderr.on('data', (c) => prefixLines(svc.name, svc.color, c))
  child.on('exit', (code, signal) => {
    if (closing) return
    process.stdout.write(
      `${svc.color}[${svc.name}]${RESET} 进程退出（code=${code} signal=${signal}），正在关闭全部服务...\n`
    )
    shutdown(code === 0 ? 1 : code ?? 1)
  })
})

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('exit', () => children.forEach((c) => { try { c.kill() } catch {} }))

process.stdout.write(
  `\n  TyphoonEye 开发服务启动中...\n` +
  `  后端  ${SERVICES[0].url}\n` +
  `  前端  ${SERVICES[1].url}   （演示账号 demo / demo123）\n` +
  `  Ctrl+C 同时停止两个服务\n\n`
)
