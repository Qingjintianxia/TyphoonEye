<template>
  <template v-if="isGuestPage">
    <router-view />
  </template>
  <AppLayout v-else />

  <!-- 全局提示层，整个应用只挂载一次 -->
  <ToastHost />
</template>

<script setup>
import { computed, onErrorCaptured } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from './components/AppLayout.vue'
import ToastHost from './components/ToastHost.vue'
import { toast } from './utils/toast'

const route = useRoute()

/**
 * 路由是否已完成首次解析。
 * vue-router 的初始路由是异步解析的：首次渲染时 route 仍是 START_LOCATION（name 为空、meta 为 {}）。
 * 若此时按 meta.guest 判断，undefined 会被当成"受保护页"而套上 AppLayout，
 * 导致布局层在登录页抢跑挂载、发出一批无 token 请求。
 */
const routeReady = computed(() => !!route.name)

/** 未就绪时按游客页处理：只渲染 router-view（此时它渲染为空），不套布局 */
const isGuestPage = computed(() => !routeReady.value || !!route.meta.guest)

// 全局错误边界：捕获子组件渲染/生命周期异常，避免整页白屏
onErrorCaptured((err) => {
  console.error('[app] 组件异常：', err)
  toast.error('页面出现异常，已拦截，请刷新重试')
  return false
})
</script>
