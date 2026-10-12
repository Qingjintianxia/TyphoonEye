'use strict'

/**
 * JSON 持久层单元测试
 *
 * 两件事必须证明：
 * 脏数据与缺文件返回 fallback，不让接口 500。
 * 并发 mutate 不丢数据。
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const jsonStore = require('../../server/lib/jsonStore')

/** 每个用例一个独立临时目录，互不干扰 */
function tmpFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'typhoon-store-'))
  return path.join(dir, name)
}

test('read：文件不存在返回 fallback，不抛异常', () => {
  assert.deepEqual(jsonStore.read(tmpFile('missing.json'), []), [])
  assert.deepEqual(jsonStore.read(tmpFile('missing2.json'), ['x']), ['x'])
})

test('read：空文件返回 fallback', () => {
  const f = tmpFile('empty.json')
  fs.writeFileSync(f, '   ')
  assert.deepEqual(jsonStore.read(f, []), [])
})

test('read：非法 JSON 返回 fallback（脏数据不让进程挂掉）', () => {
  const f = tmpFile('broken.json')
  fs.writeFileSync(f, '{ this is not json')
  assert.deepEqual(jsonStore.read(f, []), [])
})

test('read：内容不是数组时返回 fallback', () => {
  const f = tmpFile('object.json')
  fs.writeFileSync(f, JSON.stringify({ a: 1 }))
  assert.deepEqual(jsonStore.read(f, []), [])
})

test('readObject：非对象形态返回 fallback', () => {
  const arrFile = tmpFile('arr.json')
  fs.writeFileSync(arrFile, JSON.stringify([1, 2]))
  assert.deepEqual(jsonStore.readObject(arrFile, { fallback: true }), { fallback: true })
})

test('write + read 往返一致', () => {
  const f = tmpFile('rt.json')
  jsonStore.write(f, [{ id: 1, name: 'a' }])
  assert.deepEqual(jsonStore.read(f, []), [{ id: 1, name: 'a' }])
})

test('write：自动创建不存在的目录', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'typhoon-deep-'))
  const f = path.join(dir, 'a', 'b', 'data.json')
  jsonStore.write(f, [1])
  assert.deepEqual(jsonStore.read(f, []), [1])
})

test('write：不残留 .tmp 文件（原子写完即改名）', () => {
  const f = tmpFile('atomic.json')
  jsonStore.write(f, [1, 2])
  assert.equal(fs.existsSync(`${f}.tmp`), false)
})

test('mutate：追加生效并落盘', async () => {
  const f = tmpFile('mut.json')
  const next = await jsonStore.mutate(f, (list) => [...list, { n: 1 }])
  assert.equal(next.length, 1)
  assert.equal(jsonStore.read(f, []).length, 1)
})

test('mutate：并发 5 次各追加一条，最终必须 5 条（写锁有效）', async () => {
  const f = tmpFile('concurrent.json')
  await Promise.all(
    [1, 2, 3, 4, 5].map((n) => jsonStore.mutate(f, (list) => [...list, { n }]))
  )
  const saved = jsonStore.read(f, [])
  assert.equal(saved.length, 5, `并发写入丢失数据，实际 ${saved.length} 条`)
  assert.deepEqual(saved.map((x) => x.n).sort((a, b) => a - b), [1, 2, 3, 4, 5])
})

test('mutate：mutator 抛错则放弃写入，文件保持原样', async () => {
  const f = tmpFile('guard.json')
  jsonStore.write(f, [{ id: 'keep' }])

  await assert.rejects(
    () => jsonStore.mutate(f, () => { throw new Error('校验失败') }),
    /校验失败/
  )
  assert.deepEqual(jsonStore.read(f, []), [{ id: 'keep' }])
})

test('mutate：返回 null/undefined 表示放弃写入', async () => {
  const f = tmpFile('skip.json')
  jsonStore.write(f, [{ id: 'a' }])
  const kept = await jsonStore.mutate(f, () => null)
  assert.deepEqual(kept, [{ id: 'a' }])
  assert.deepEqual(jsonStore.read(f, []), [{ id: 'a' }])
})

test('withLock：一次失败不会卡死后续写入', async () => {
  await assert.rejects(() => jsonStore.withLock(() => { throw new Error('boom') }), /boom/)
  const ok = await jsonStore.withLock(() => 'ok')
  assert.equal(ok, 'ok')
})
