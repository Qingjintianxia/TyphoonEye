'use strict'

/**
 * JSON 文件持久层，供 users / tickets / notifications 共用。
 *
 * 写锁是单进程内的一条 Promise 链。多实例或集群部署时该锁无效，
 * 需要换成数据库事务或分布式锁。
 */

const fs = require('fs')
const path = require('path')

/** 读取集合。文件不存在、为空或解析失败都返回 fallback */
function read(file, fallback = []) {
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    if (!raw || !raw.trim()) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch (e) {
    if (e.code === 'ENOENT') return fallback
    // 解析失败：保留现场但不要让进程挂掉
    console.warn(`[jsonStore] 读取 ${path.basename(file)} 失败，按空集合处理：`, e.message)
    return fallback
  }
}

/** 读取对象（非数组形态），语义同 read */
function readObject(file, fallback = {}) {
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    if (!raw || !raw.trim()) return fallback
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
  } catch (e) {
    if (e.code === 'ENOENT') return fallback
    console.warn(`[jsonStore] 读取 ${path.basename(file)} 失败，按默认对象处理：`, e.message)
    return fallback
  }
}

/** 原子写：先落 .tmp 再 rename，不直接覆盖目标文件 */
function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}

/**
 * 全局串行写锁。
 * 关键：链条必须吞掉 rejection（then(()=>{}, ()=>{})），
 * 否则一次失败会让后续所有写操作永远挂在 rejected 的 promise 上。
 */
let chain = Promise.resolve()
function withLock(fn) {
  const run = chain.then(fn, fn)
  chain = run.then(() => {}, () => {})
  return run
}

/**
 * 读—改—写，整段在锁内。
 * 这是"并发注册不丢数据"那类正确性的来源：拆分 read 与 write 会引入 read-modify-write 竞态。
 *
 * @param {string} file
 * @param {(data:any[]) => any[]|Promise<any[]>} mutator 返回新集合（或抛错以放弃写入）
 * @param {any[]} fallback
 * @returns {Promise<any[]>} 写入后的集合
 */
async function mutate(file, mutator, fallback = []) {
  return withLock(async () => {
    const current = read(file, fallback)
    const next = await mutator(current)
    if (next === undefined || next === null) return current // 放弃写入
    write(file, next)
    return next
  })
}

async function mutateObject(file, mutator, fallback = {}) {
  return withLock(async () => {
    const current = readObject(file, fallback)
    const next = await mutator(current)
    if (next === undefined || next === null) return current
    write(file, next)
    return next
  })
}

module.exports = { read, readObject, write, withLock, mutate, mutateObject }
