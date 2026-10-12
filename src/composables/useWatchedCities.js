import { ref, watch } from 'vue'
import { findCity, allCities } from '../constants/cities'

/**
 * 关注城市 + 本地持久化
 *
 * 容错原则：
 * 读：解析失败、非数组与未收录的城市一律丢弃。
 * 写：localStorage 不可用时降级为纯内存态，刷新后丢失。
 * 默认不预设关注城市。
 */

const STORAGE_KEY = 'typhooneye.watchedCities'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((name) => typeof name === 'string' && findCity(name))
  } catch {
    return []
  }
}

function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 降级为内存态，不做提示
  }
}

export function useWatchedCities() {
  const watched = ref(load())

  watch(watched, (list) => save(list), { deep: true })

  function isWatched(name) {
    return watched.value.includes(name)
  }

  function add(name) {
    // 只接受已收录城市，未收录的无法参与距离计算
    if (!name || !findCity(name) || isWatched(name)) return
    watched.value = [...watched.value, name]
  }

  function remove(name) {
    watched.value = watched.value.filter((n) => n !== name)
  }

  function toggle(name) {
    isWatched(name) ? remove(name) : add(name)
  }

  function clear() {
    watched.value = []
  }

  return {
    watched,
    isWatched,
    add,
    remove,
    toggle,
    clear,
    allCities
  }
}
