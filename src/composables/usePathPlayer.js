import { ref, computed, watch, toValue, onScopeDispose } from 'vue'
import { parseTime } from '../utils/format'

/**
 * 台风路径回放状态机。
 *
 * 集中管理 index / playing / speed 与定时器，避免播放逻辑散落到各个组件。
 * 组件只负责渲染与转发事件。
 */

/** 1x 速度下每帧间隔（ms） */
const BASE_INTERVAL = 900

/** 可选倍速 */
export const SPEED_OPTIONS = [0.5, 1, 2]

export function usePathPlayer(pathSource) {
  const index = ref(0)
  const playing = ref(false)
  const speed = ref(1)
  let timer = null

  const points = computed(() => {
    const list = toValue(pathSource)
    return Array.isArray(list) ? list : []
  })
  const total = computed(() => points.value.length)
  const canPlay = computed(() => total.value > 1)
  const current = computed(() => points.value[index.value] || null)

  function clearTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function startTimer() {
    clearTimer()
    timer = setInterval(() => {
      if (index.value >= total.value - 1) {
        pause()
        return
      }
      index.value += 1
    }, Math.max(120, BASE_INTERVAL / speed.value))
  }

  function play() {
    if (!canPlay.value || playing.value) return
    // 已在末点时重新从头播放，否则停住不动会让人以为坏了
    if (index.value >= total.value - 1) index.value = 0
    playing.value = true
    startTimer()
  }

  function pause() {
    clearTimer()
    playing.value = false
  }

  function toggle() {
    playing.value ? pause() : play()
  }

  function seek(i) {
    const n = total.value
    if (!n) return
    const next = Math.max(0, Math.min(n - 1, Number(i) || 0))
    index.value = next
  }

  function reset(i = 0) {
    pause()
    seek(i)
  }

  function setSpeed(s) {
    speed.value = Number(s) || 1
    // 正在播放时重启定时器以应用新间隔
    if (playing.value) startTimer()
  }

  /**
   * 定位实况末点：path 中 time <= updateTime 的最后一项。
   * 用于把回放初始位置落在"当前时刻"，并区分实况段与预报段。
   */
  function indexOfRealtime(updateTime) {
    const n = total.value
    if (!n) return 0
    const base = parseTime(updateTime)
    if (!base) return n - 1
    let found = -1
    points.value.forEach((p, i) => {
      const t = parseTime(p && p.time)
      if (t && t.getTime() <= base.getTime()) found = i
    })
    return found === -1 ? n - 1 : found
  }

  // 路径数据变化（切换台风）时停止播放并把下标收敛到合法范围
  watch(total, (n) => {
    pause()
    if (index.value > n - 1) index.value = Math.max(0, n - 1)
  })

  onScopeDispose(pause)

  return {
    index,
    playing,
    speed,
    points,
    total,
    canPlay,
    current,
    play,
    pause,
    toggle,
    seek,
    reset,
    setSpeed,
    indexOfRealtime,
    speedOptions: SPEED_OPTIONS
  }
}
