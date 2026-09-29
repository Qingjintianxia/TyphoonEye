/**
 * 全局轻量提示（Toast）
 *
 * 设计为模块级响应式队列：任意模块（含 store、request 层）都可直接调用，
 * 无需传递组件实例。展示由 <ToastHost /> 统一渲染，在 App.vue 全局挂载一次。
 */
import { reactive } from 'vue'

let seed = 0

export const toasts = reactive([])

const DURATION = { success: 2600, info: 2600, warning: 3600, error: 4200 }

function push(type, message, duration) {
  const id = ++seed
  toasts.push({ id, type, message })
  const life = duration ?? DURATION[type] ?? 3000
  if (life > 0) {
    setTimeout(() => dismiss(id), life)
  }
  return id
}

export function dismiss(id) {
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx > -1) toasts.splice(idx, 1)
}

export const toast = {
  success: (msg, duration) => push('success', msg, duration),
  info: (msg, duration) => push('info', msg, duration),
  warning: (msg, duration) => push('warning', msg, duration),
  error: (msg, duration) => push('error', msg, duration),
  /** 0 表示不自动关闭，需业务侧手动 dismiss */
  persistent: (type, msg) => push(type, msg, 0)
}

/** 组合式 API 入口，组件内推荐使用 */
export function useToast() {
  return toast
}
