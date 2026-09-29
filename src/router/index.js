import { createRouter, createWebHistory } from 'vue-router'
import { isTokenValid } from '../utils/token'
import { setToken } from '../utils/request'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录', guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { title: '注册', guest: true }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '仪表盘', icon: 'dashboard' }
  },
  {
    path: '/monitor',
    name: 'Monitor',
    component: () => import('../views/TyphoonMonitor.vue'),
    meta: { title: '台风监控', icon: 'monitor' }
  },
  {
    path: '/alerts',
    name: 'Alerts',
    component: () => import('../views/AlertCenter.vue'),
    meta: { title: '预警中心', icon: 'alerts' }
  },
  {
    path: '/typhoon/:id',
    name: 'TyphoonDetail',
    component: () => import('../views/TyphoonDetail.vue'),
    meta: { title: '台风详情', icon: '' }
  },
  {
    path: '/tickets',
    name: 'Tickets',
    component: () => import('../views/TicketCenter.vue'),
    meta: { title: '处置工单', icon: 'tickets' }
  },
  {
    path: '/messages',
    name: 'Messages',
    component: () => import('../views/MessageCenter.vue'),
    meta: { title: '消息中心', icon: 'messages' }
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/HistoryView.vue'),
    meta: { title: '历史数据', icon: 'history' }
  },
  {
    path: '/compare',
    name: 'Compare',
    component: () => import('../views/TyphoonCompare.vue'),
    meta: { title: '路径对比', icon: 'compare' }
  },
  {
    // catch-all：任意未匹配路径进入 404，避免出现空白页
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
    meta: { title: '页面不存在', guest: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

const APP_NAME = '台风预警系统'

router.beforeEach((to) => {
  // 404 页始终可访问，不做登录态重定向
  if (to.name === 'NotFound') return true

  // 已登录用户访问登录/注册页时，回跳目标页或首页
  if (to.meta.guest) {
    if (isTokenValid()) {
      const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
      return redirect
    }
    return true
  }

  // 受保护页面：不仅要求 token 存在，还要求未过期。
  // 过期 token 在此处即被拦截，避免"先进内页再被踢出"造成的闪烁。
  if (!isTokenValid()) {
    setToken('')
    return { path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME
})

export default router
