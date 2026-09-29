import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import http, { setToken, getToken } from '../utils/request'
import { isTokenValid } from '../utils/token'

/**
 * 认证 store
 *
 * 约定：登录/注册/拉取用户信息的错误由页面自行展示（表单内联错误），
 * 因此统一传 silent: true，避免请求层 Toast 与表单错误重复提示。
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(getToken())
  const loading = ref(false)

  const isLoggedIn = computed(() => !!token.value && isTokenValid(token.value))

  function applySession(data) {
    token.value = data?.token || ''
    user.value = data?.user || null
    setToken(token.value)
  }

  async function login(username, password) {
    loading.value = true
    try {
      const data = await http.post('/auth/login', { username, password }, { silent: true })
      applySession(data)
      return data
    } finally {
      loading.value = false
    }
  }

  async function register(username, password, email) {
    loading.value = true
    try {
      const data = await http.post('/auth/register', { username, password, email }, { silent: true })
      applySession(data)
      return data
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    if (!isTokenValid(token.value)) {
      if (token.value) logout()
      return null
    }
    try {
      const data = await http.get('/auth/me', undefined, { silent: true })
      user.value = data || null
      return user.value
    } catch {
      logout()
      return null
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    setToken('')
  }

  return { user, token, loading, isLoggedIn, login, register, fetchMe, logout }
})
