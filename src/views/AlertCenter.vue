<template>
  <div>
    <h1 class="page-title">预警中心</h1>
    <p class="page-subtitle">
      台风预警信息管理与追踪
      <span class="ac-breakdown">
        · 人工发布 {{ alertStore.breakdown.manual }} 条 / 规则派生 {{ alertStore.breakdown.rule }} 条
      </span>
    </p>

    <div v-if="alertStore.loading" class="loading-state">加载中...</div>
    <div v-else-if="alertStore.error" class="state-wrap">
      <ErrorState
        :title="'预警加载失败'"
        :description="alertStore.error"
        :loading="alertStore.loading"
        @retry="alertStore.fetchAlerts()"
      />
    </div>

    <template v-else>
      <!-- 地理围栏告警：基于关注城市 × 活跃台风前端派生，与下方后端预警分区展示，
           避免用户误以为是服务端新增的预警条目 -->
      <div class="ac-fence">
        <!-- 预警中心没有地图：点击城市时跳到监控页并带 ?focus= 深链定位 -->
        <FenceAlerts :typhoons="typhoonStore.typhoons" @locate="locateCity" />
      </div>

      <!-- 来源筛选：自动派生的结论必须与人工研判可区分 -->
      <div class="ac-source-row">
        <button
          class="filter-tab"
          v-for="s in SOURCE_FILTERS"
          :key="s.key"
          :class="{ active: activeSource === s.key }"
          @click="setSource(s.key)"
        >{{ s.label }} ({{ sourceCount(s.key) }})</button>
      </div>

      <!-- Filter Tabs -->
      <div class="filter-tabs" style="margin-bottom: 20px;">
        <button class="filter-tab" :class="{ active: activeFilter === '' }" @click="setFilter('')">
          全部 ({{ totalCount }})
        </button>
        <button class="filter-tab" :class="{ active: activeFilter === 'red' }" @click="setFilter('red')">
          红色预警 ({{ alertStore.redAlerts.length }})
        </button>
        <button class="filter-tab" :class="{ active: activeFilter === 'orange' }" @click="setFilter('orange')">
          橙色预警 ({{ alertStore.orangeAlerts.length }})
        </button>
        <button class="filter-tab" :class="{ active: activeFilter === 'yellow' }" @click="setFilter('yellow')">
          黄色预警 ({{ alertStore.yellowAlerts.length }})
        </button>
        <button class="filter-tab" :class="{ active: activeFilter === 'blue' }" @click="setFilter('blue')">
          蓝色预警 ({{ alertStore.blueAlerts.length }})
        </button>
      </div>

      <!-- 批量推送工具条：选中后才出现，避免常驻干扰阅读 -->
      <div class="ac-toolbar glass-card" v-if="selectedIds.length">
        <span class="act-count">已选 {{ selectedIds.length }} 条</span>
        <select class="act-select" v-model="dispatchAssignee">
          <option value="">全体广播</option>
          <option v-for="u in users" :key="u.id || u.username" :value="u.username">{{ u.username }}</option>
        </select>
        <button class="btn act-btn" @click="dispatch" :disabled="dispatching">
          {{ dispatching ? '推送中...' : '推送通知' }}
        </button>
        <button class="btn act-btn" @click="selectedIds = []">清空选择</button>
      </div>

      <!-- Alert Grid -->
      <div class="alert-grid">
        <div class="alert-card glass-card fade-in" v-for="(a, i) in filteredAlerts"
             :key="a.id" :class="[`alert-card-${a.level}`, `fade-in-${Math.min(i % 4 + 1, 4)}`]">
          <div class="ac-header">
            <div class="ac-tags">
              <span class="warn-tag is-lg" :class="`warn-${a.level}`">{{ warningLabel(a.level) }}</span>
              <span class="badge" :class="alertSourceMeta(a.source).badge">{{ alertSourceMeta(a.source).label }}</span>
              <input class="ac-check" type="checkbox" :value="a.id" v-model="selectedIds"
                     :aria-label="`选择预警 ${a.title}`" />
            </div>
            <span class="ac-time">{{ formatDateTime(a.publishTime) }}</span>
          </div>
          <h3 class="ac-title">{{ a.title }}</h3>
          <p class="ac-content">{{ a.content }}</p>
          <div class="ac-rule" v-if="a.source === 'rule' && a.ruleKey">
            命中规则：<code>{{ a.ruleKey }}</code>
          </div>
          <div class="ac-footer">
            <div class="ac-city">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {{ a.city || '—' }}
            </div>
            <div class="ac-actions">
              <!-- 已建单则改为跳转，避免用户重复点击撞上后端 400 -->
              <router-link v-if="ticketStore.ticketedAlertIds.has(a.id)" to="/tickets" class="ac-link">
                查看工单 →
              </router-link>
              <button v-else class="ac-btn" @click="openCreate(a)" :disabled="ticketStore.submitting">
                生成工单
              </button>
              <router-link :to="`/typhoon/${a.typhoonId}`" class="ac-link">台风详情 →</router-link>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!filteredAlerts.length" class="empty-state" style="padding: 60px;">
        暂无匹配的预警信息
      </div>
    </template>

    <TicketCreateDialog
      :open="dialogOpen"
      :alert="currentAlert"
      :users="users"
      @close="dialogOpen = false"
      @created="onCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAlertStore } from '../stores/alert'
import { useTyphoonStore } from '../stores/typhoon'
import { useTicketStore } from '../stores/ticket'
import { warningLabel } from '../constants/typhoon'
import { alertSourceMeta } from '../constants/ticket'
import { formatDateTime } from '../utils/format'
import http from '../utils/request'
import { toast } from '../utils/toast'
import ErrorState from '../components/ErrorState.vue'
import FenceAlerts from '../components/FenceAlerts.vue'
import TicketCreateDialog from '../components/TicketCreateDialog.vue'

const SOURCE_FILTERS = [
  { key: '', label: '全部来源' },
  { key: 'manual', label: '人工发布' },
  { key: 'rule', label: '规则派生' }
]

const alertStore = useAlertStore()
const typhoonStore = useTyphoonStore()
const ticketStore = useTicketStore()
const router = useRouter()

/**
 * 本页无地图，点击城市不能"点了没反应"：跳监控页并用 ?focus= 深链定位。
 * 坐标是否收录由监控页判断并提示，这里不重复校验。
 */
function locateCity(city) {
  if (!city?.name) return
  router.push({ path: '/monitor', query: { focus: city.name } })
}

const activeFilter = ref('')
const activeSource = ref('')
const selectedIds = ref([])
const users = ref([])
const dispatchAssignee = ref('')
const dispatching = ref(false)
const dialogOpen = ref(false)
const currentAlert = ref(null)

// 围栏计算依赖台风数据；预警中心是独立入口，可能未加载过台风列表
// 工单列表用于判断"该预警是否已建单"；用户列表用于负责人下拉
onMounted(() => {
  if (!typhoonStore.typhoons.length) typhoonStore.fetchTyphoons()
  ticketStore.fetchTickets().catch(() => {})
  http.get('/auth/users').then((list) => { users.value = Array.isArray(list) ? list : [] }).catch(() => {})
})

const filteredAlerts = computed(() => {
  let list = alertStore.alerts
  if (activeSource.value) list = list.filter((a) => a.source === activeSource.value)
  if (activeFilter.value) return list.filter((a) => a.level === activeFilter.value)
  return list
})

const totalCount = computed(() => alertStore.alerts.length)

function sourceCount(key) {
  return key ? alertStore.groupedBySource[key]?.length || 0 : totalCount.value
}

function setFilter(level) { activeFilter.value = level }

function setSource(key) { activeSource.value = key }

function openCreate(alert) {
  currentAlert.value = alert
  dialogOpen.value = true
}

function onCreated() {
  selectedIds.value = selectedIds.value.filter((id) => id !== currentAlert.value?.id)
}

async function dispatch() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  dispatching.value = true
  try {
    const res = await alertStore.dispatch(ids, dispatchAssignee.value)
    toast.success(`已推送 ${res.sent}/${res.total} 条`)
    selectedIds.value = []
  } catch (e) {
    // 请求层已 toast，这里只复位按钮状态
    console.warn('[alerts] 推送失败：', e)
  } finally {
    dispatching.value = false
  }
}
</script>

<style scoped>
.ac-fence { margin-bottom: 24px; }

.ac-breakdown { color: var(--text-muted); }

.ac-source-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.ac-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.act-count { font-size: 13px; color: var(--text-secondary); }

.act-select {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.act-select:focus { border-color: var(--blue); }

.act-btn { padding: 6px 14px; font-size: 13px; }

.alert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.alert-card {
  padding: 20px;
  border-left: 3px solid transparent;
}

.alert-card-red { border-left-color: var(--red); }
.alert-card-orange { border-left-color: var(--orange); }
.alert-card-yellow { border-left-color: var(--yellow); }
.alert-card-blue { border-left-color: var(--blue); }

.ac-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.ac-tags { display: flex; align-items: center; gap: 8px; }

.ac-check { width: 14px; height: 14px; accent-color: var(--blue); cursor: pointer; }

.ac-time {
  font-size: 12px;
  color: var(--text-muted);
}

.ac-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.ac-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 14px;
}

.ac-rule {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.ac-rule code {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 11px;
}

.ac-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.ac-city {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.ac-actions { display: flex; align-items: center; gap: 12px; }

.ac-btn {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--blue);
  font-size: 12px;
  padding: 4px 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all var(--transition);
}
.ac-btn:hover:not(:disabled) { border-color: var(--blue); background: rgba(59, 130, 246, 0.1); }
.ac-btn:disabled { color: var(--text-muted); cursor: default; }

.ac-link {
  font-size: 13px;
  color: var(--blue);
  text-decoration: none;
}

.ac-link:hover { text-decoration: underline; }

.empty-state, .loading-state, .state-wrap {
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.state-wrap { padding: 40px 0; }
</style>
