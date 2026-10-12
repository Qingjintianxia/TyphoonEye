/**
 * 异步资源封装
 *
 * 统一管理 loading / error / data，处理卸载后的回调与请求竞态，并提供重试入口。
 *
 * 用法：
 * const { data, loading, error, run, retry } = useAsyncResource(() => http.get('/x'), { immediate: true })
 */
import { ref, onUnmounted, getCurrentInstance } from 'vue'

export function useAsyncResource(fetcher, options = {}) {
  const { immediate = false, initial = null, silent = false } = options

  const data = ref(initial)
  const loading = ref(false)
  const error = ref('')
  const lastLoadedAt = ref(null)

  // 请求序号：只接受最新一次请求的结果
  let seq = 0
  let aborted = false

  async function run(...args) {
    const current = ++seq
    loading.value = true
    error.value = ''
    try {
      const result = await fetcher(...args)
      if (aborted || current !== seq) return result
      data.value = result ?? initial
      lastLoadedAt.value = Date.now()
      return result
    } catch (e) {
      if (aborted || current !== seq) throw e
      // 鉴权失败由请求层跳转，此处不改写错误文案
      error.value = e?.isUnauthorized ? '' : (e?.message || '数据加载失败')
      if (!silent) throw e
      return null
    } finally {
      if (!aborted && current === seq) loading.value = false
    }
  }

  function retry(...args) {
    return run(...args)
  }

  /** 供模板直接绑定的安全重置 */
  function reset() {
    seq++
    data.value = initial
    error.value = ''
    loading.value = false
    lastLoadedAt.value = null
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      aborted = true
    })
  }

  if (immediate) {
    run()
  }

  return { data, loading, error, lastLoadedAt, run, retry, reset }
}
