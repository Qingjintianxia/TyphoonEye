<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2a10 10 0 0 1 0 20"/>
            <path d="M12 2a10 10 0 0 0 0 20"/>
            <path d="M2 12h20"/>
          </svg>
        </div>
        <h1 class="auth-title">TyphoonEye</h1>
        <p class="auth-subtitle">台风预警系统 · 注册</p>
      </div>

      <form class="auth-form" @submit.prevent="handleRegister">
        <div class="field-error" v-if="error">{{ error }}</div>

        <div class="form-group">
          <label class="form-label">用户名</label>
          <input
            v-model="username"
            type="text"
            class="form-input"
            placeholder="至少3个字符"
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label class="form-label">邮箱（选填）</label>
          <input
            v-model="email"
            type="email"
            class="form-input"
            placeholder="请输入邮箱"
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label class="form-label">密码</label>
          <input
            v-model="password"
            type="password"
            class="form-input"
            placeholder="至少6个字符"
            autocomplete="new-password"
          />
        </div>

        <div class="form-group">
          <label class="form-label">确认密码</label>
          <input
            v-model="confirmPassword"
            type="password"
            class="form-input"
            placeholder="再次输入密码"
            autocomplete="new-password"
          />
        </div>

        <button type="submit" class="btn btn-primary auth-btn" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>

      <div class="auth-footer">
        已有账号？<router-link to="/login" class="auth-link">去登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  error.value = ''
  if (!username.value || username.value.length < 3) {
    error.value = '用户名至少3个字符'
    return
  }
  if (!password.value || password.value.length < 6) {
    error.value = '密码至少6个字符'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次密码输入不一致'
    return
  }
  loading.value = true
  try {
    await authStore.register(username.value, password.value, email.value)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.auth-card {
  width: 400px;
  padding: 40px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-icon {
  color: var(--blue);
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.auth-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.auth-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input {
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--transition);
}

.form-input:focus {
  border-color: var(--blue);
}

.form-input::placeholder {
  color: var(--text-muted);
}

.field-error {
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  color: #f87171;
  font-size: 13px;
}

.auth-btn {
  width: 100%;
  justify-content: center;
  padding: 12px;
  font-size: 15px;
  margin-top: 4px;
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: var(--text-muted);
}

.auth-link {
  color: var(--blue);
  text-decoration: none;
  font-weight: 500;
}

.auth-link:hover {
  text-decoration: underline;
}
</style>
