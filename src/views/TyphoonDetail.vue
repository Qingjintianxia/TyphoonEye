<template>
  <div v-if="typhoon">
    <div class="detail-header">
      <router-link to="/monitor" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        返回监控
      </router-link>
    </div>

    <div class="detail-hero">
      <div class="hero-info">
        <div class="hero-name">
          <h1>{{ typhoon.name }}</h1>
          <span class="hero-ename">{{ typhoon.nameEn }}</span>
          <span class="badge" :class="statusMeta(typhoon.status).badge" style="margin-left: 12px;">
            {{ statusMeta(typhoon.status).label }}
          </span>
        </div>
        <p class="hero-desc">{{ typhoon.description || '暂无描述' }}</p>
        <div class="hero-meta">
          <span>生成时间: {{ formatDateTime(typhoon.startTime) }}</span>
          <span class="dot">·</span>
          <span>更新: {{ formatDateTime(typhoon.updateTime) }}</span>
          <span class="dot">·</span>
          <span>编号: {{ typhoon.id }}</span>
        </div>
      </div>
      <div class="hero-level">
        <div class="level-badge-large" :class="`level-${typhoon.warningLevel}`">
          {{ warningLabel(typhoon.warningLevel) }}
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="detail-stats">
      <div class="d-stat glass-card">
        <div class="ds-label">中心最大风速</div>
        <div class="ds-value">{{ formatWind(typhoon.windSpeed) }}</div>
      </div>
      <div class="d-stat glass-card">
        <div class="ds-label">中心最低气压</div>
        <div class="ds-value">{{ formatPressure(typhoon.pressure) }}</div>
      </div>
      <div class="d-stat glass-card">
        <div class="ds-label">强度等级</div>
        <div class="ds-value">{{ typhoon.level }}</div>
      </div>
      <div class="d-stat glass-card">
        <div class="ds-label">中心位置</div>
        <div class="ds-value">{{ formatCoord(typhoon.latitude, typhoon.longitude) }}</div>
      </div>
    </div>

    <!-- Single Typhoon Map: path + real-proportion wind rings -->
      <div style="margin-bottom: 28px;">
        <TyphoonDetailMap
          :typhoon="typhoon"
          :current-index="playIndex"
          :focus-city="focusCity"
          :focus-seq="focusSeq"
        />
      </div>

    <!-- Wind Radius -->
    <div class="content-grid" style="margin-bottom: 28px;">
      <div class="glass-card" style="padding: 24px;">
        <h3 class="section-title" style="margin-bottom: 20px;">风圈半径（真实比例）</h3>
        <WindRingChart :typhoon="typhoon" />
      </div>

      <div class="glass-card" style="padding: 24px;">
        <h3 class="section-title" style="margin-bottom: 20px;">城市影响评估</h3>
        <CityImpactPanel
          :typhoon="typhoon"
          :located-name="focusCity?.name || ''"
          @locate="locateCity"
        />
      </div>
    </div>

    <!-- 关联预警与处置：详情页就地建单，避免"看到预警还要跳回预警中心" -->
    <div class="glass-card td-alerts" style="padding: 24px; margin-bottom: 28px;">
      <div class="tda-head">
        <h3 class="section-title">关联预警</h3>
        <span class="tda-count" v-if="relatedAlerts.length">{{ relatedAlerts.length }} 条</span>
      </div>

      <div v-if="!relatedAlerts.length" class="text-muted" style="padding: 16px 0;">
        该台风当前没有关联预警
      </div>

      <div v-else class="tda-list">
        <div class="tda-item" v-for="a in relatedAlerts" :key="a.id">
          <div class="tda-left">
            <span class="warn-tag" :class="`warn-${a.level}`">{{ warningLabel(a.level) }}</span>
            <span class="badge" :class="alertSourceMeta(a.source).badge">{{ alertSourceMeta(a.source).label }}</span>
            <span class="tda-title">{{ a.title }}</span>
          </div>
          <div class="tda-right">
            <span class="tda-city">{{ a.city || '—' }}</span>
            <router-link v-if="ticketStore.ticketedAlertIds.has(a.id)" to="/tickets" class="tda-link">
              查看工单 →
            </router-link>
            <button v-else class="tda-btn" @click="openCreate(a)" :disabled="ticketStore.submitting">
              生成工单
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Path Replay：时间轴回放 + 强度演变 -->
    <div class="glass-card" style="padding: 24px; margin-bottom: 28px;">
      <h3 class="section-title" style="margin-bottom: 16px;">路径回放</h3>
      <PathTimelinePlayer
        v-if="pathTotal > 0"
        :points="pathPoints"
        :index="playIndex"
        :playing="playing"
        :speed="speed"
        :can-play="canPlay"
        :realtime-index="realtimeIndex"
        @toggle="togglePlay"
        @seek="seekPath"
        @speed-change="setSpeed"
        @reset="resetPlay"
      />
      <IntensityTrendChart
        :points="pathPoints"
        :index="playIndex"
        :realtime-index="realtimeIndex"
        style="margin-top: 16px;"
      />
    </div>

    <!-- Path Timeline：点击任意时刻可把回放跳转到该点 -->
    <div class="glass-card" style="padding: 24px; margin-bottom: 28px;">
      <h3 class="section-title" style="margin-bottom: 20px;">路径时间线</h3>
      <div class="path-timeline" v-if="pathTotal">
        <div class="pt-header">
          <span>时间</span>
          <span>位置</span>
          <span>风速</span>
          <span>等级</span>
        </div>
        <div class="pt-item" v-for="(p, i) in pathPoints" :key="i"
             :class="{ 'pt-current': i === playIndex }"
             role="button" tabindex="0"
             :aria-label="`跳转到第 ${i + 1} 个路径点`"
             @click="seekPath(i)"
             @keydown.enter.prevent="seekPath(i)"
             @keydown.space.prevent="seekPath(i)">
          <div class="pt-dot" :class="{ active: i === playIndex }"></div>
          <span class="pt-time">{{ formatDateTime(p.time) }}</span>
          <span class="pt-pos">{{ formatCoord(p.lat, p.lng) }}</span>
          <span class="pt-wind">{{ formatWind(p.wind) }}</span>
          <span class="badge" :class="levelBadgeClass(p.level)">{{ p.level }}</span>
        </div>
      </div>
      <div v-else class="text-muted" style="padding: 20px 0;">暂无路径数据</div>
    </div>

    <TicketCreateDialog
      :open="dialogOpen"
      :alert="currentAlert"
      :users="users"
      @close="dialogOpen = false"
    />
  </div>

  <div v-else-if="typhoonStore.loading" class="loading-state">加载中...</div>
  <div v-else class="state-wrap">
    <ErrorState
      title="台风数据不存在"
      :description="typhoonStore.error || '未找到该台风，可能已结束或编号有误'"
      :retryable="false"
    />
    <div class="center-row">
      <router-link to="/monitor" class="btn">返回监控</router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useTyphoonStore } from '../stores/typhoon'
import { useTicketStore } from '../stores/ticket'
import { levelBadgeClass, warningLabel, statusMeta } from '../constants/typhoon'
import { alertSourceMeta } from '../constants/ticket'
import { formatWind, formatPressure, formatCoord, formatNumber, formatDateTime, safeList } from '../utils/format'
import http from '../utils/request'
import ErrorState from '../components/ErrorState.vue'
import TyphoonDetailMap from '../components/TyphoonDetailMap.vue'
import WindRingChart from '../components/WindRingChart.vue'
import CityImpactPanel from '../components/CityImpactPanel.vue'
import PathTimelinePlayer from '../components/PathTimelinePlayer.vue'
import IntensityTrendChart from '../components/IntensityTrendChart.vue'
import TicketCreateDialog from '../components/TicketCreateDialog.vue'
import { usePathPlayer } from '../composables/usePathPlayer'
import { toast } from '../utils/toast'

const route = useRoute()
const typhoonStore = useTyphoonStore()
const ticketStore = useTicketStore()

/**
 * 关联预警：这里不走 alertStore.fetchAlerts，因为该 action 会整体替换
 * 全局预警列表；详情页只需要本台风的切片，独立请求更安全。
 */
const relatedAlerts = ref([])
const users = ref([])
const dialogOpen = ref(false)
const currentAlert = ref(null)

/**
 * 城市定位
 * focusSeq 自增的原因：再次点击同一城市（先取消、再定位）时 focusCity 的对象内容不变，
 * watch 不触发；用序号强制触发一次定位。
 */
const focusCity = ref(null)
const focusSeq = ref(0)

function locateCity(city) {
  if (!city || city.missing || !Number.isFinite(Number(city.lat))) {
    toast.warning(`${city?.name || '该城市'}暂未收录坐标，无法在地图上定位`)
    return
  }
  // 再点一次同一城市 = 取消定位，回到台风视角
  focusCity.value = focusCity.value?.name === city.name ? null : { ...city }
  focusSeq.value += 1
}

function openCreate(alert) {
  currentAlert.value = alert
  dialogOpen.value = true
}

async function loadRelated(id) {
  relatedAlerts.value = []
  if (!id) return
  try {
    const list = await http.get('/alerts', { typhoonId: id })
    relatedAlerts.value = Array.isArray(list) ? list : []
  } catch {
    relatedAlerts.value = []
  }
}

const typhoon = computed(() => typhoonStore.currentTyphoon)

/**
 * 路径回放：状态与定时器由 usePathPlayer 持有。
 * 解构成顶层 ref，模板中才能自动解包。
 */
const {
  index: playIndex,
  playing,
  speed,
  points: pathPoints,
  total: pathTotal,
  canPlay,
  toggle: togglePlay,
  seek: seekPath,
  reset: resetPlay,
  setSpeed,
  indexOfRealtime
} = usePathPlayer(() => typhoon.value?.path || [])

/** 实况末点下标：用于区分实况段与预报段 */
const realtimeIndex = ref(-1)

// 切换台风或数据加载完成时，把回放定位到"当前时刻"（实况末点）
watch(
  typhoon,
  (t) => {
    if (!t) return
    const i = indexOfRealtime(t.updateTime)
    realtimeIndex.value = i
    seekPath(i)
  },
  { immediate: true }
)

// 关键修复：从台风 A 详情跳到台风 B 详情时，组件实例复用（路由参数变、组件不卸载），
// onMounted 不会再次触发，必须 watch 路由参数重新拉取，否则停留旧数据。
async function load(id) {
  if (!id) {
    typhoonStore.clearCurrent()
    return
  }
  try {
    await typhoonStore.fetchTyphoonById(id)
  } catch {
    // 错误文案由 store / 请求层处理，这里复位 loading
  }
  // 工单列表用于判断"已建单"，用户列表用于负责人下拉；两者失败都只影响建单入口
  ticketStore.fetchTickets().catch(() => {})
  if (!users.value.length) {
    http.get('/auth/users').then((list) => { users.value = Array.isArray(list) ? list : [] }).catch(() => {})
  }
  await loadRelated(id)
}

watch(
  () => route.params.id,
  (id) => load(id),
  { immediate: true }
)

onBeforeUnmount(() => typhoonStore.clearCurrent())
</script>

<style scoped>
.detail-header { margin-bottom: 16px; }
.back-link {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--text-secondary); text-decoration: none;
}
.back-link:hover { color: var(--text-primary); }

.detail-hero {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 28px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius);
  margin-bottom: 24px;
}

.hero-name { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.hero-name h1 { font-size: 32px; font-weight: 700; letter-spacing: -1px; }
.hero-ename { font-size: 14px; color: var(--text-muted); }

.hero-desc { font-size: 14px; color: var(--text-secondary); margin-bottom: 10px; max-width: 600px; line-height: 1.6; }
.hero-meta { font-size: 12px; color: var(--text-muted); }
.dot { margin: 0 6px; }

.level-badge-large {
  padding: 14px 28px; border-radius: var(--radius); font-size: 18px; font-weight: 700;
}
.level-red { background: rgba(239,68,68,0.15); color: #f87171; border: 2px solid var(--red); }
.level-orange { background: rgba(249,115,22,0.15); color: #fb923c; border: 2px solid var(--orange); }
.level-yellow { background: rgba(245,158,11,0.15); color: #fbbf24; border: 2px solid var(--yellow); }
.level-blue { background: rgba(59,130,246,0.15); color: #60a5fa; border: 2px solid var(--blue); }

.detail-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px;
}

.d-stat { padding: 20px; text-align: center; }
.ds-label { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
.ds-value { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ds-value span { font-size: 13px; font-weight: 400; color: var(--text-muted); }

.text-muted { color: var(--text-muted); }

/* 关联预警 */
.tda-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.tda-count { font-size: 12px; color: var(--text-muted); }

.tda-list { display: flex; flex-direction: column; }

.tda-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.tda-item:last-child { border-bottom: none; }

.tda-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tda-title { font-size: 14px; font-weight: 600; }

.tda-right { display: flex; align-items: center; gap: 12px; }
.tda-city { font-size: 12px; color: var(--text-secondary); }

.tda-btn {
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
.tda-btn:hover:not(:disabled) { border-color: var(--blue); background: rgba(59, 130, 246, 0.1); }
.tda-btn:disabled { color: var(--text-muted); cursor: default; }

.tda-link { font-size: 12px; color: var(--blue); text-decoration: none; }
.tda-link:hover { text-decoration: underline; }

.pt-header {
  display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 1fr;
  padding: 10px 0 10px 32px; font-size: 12px; color: var(--text-muted);
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}

.pt-item {
  display: grid; grid-template-columns: 1.5fr 1.5fr 1fr 1fr;
  padding: 14px 0 14px 32px; border-bottom: 1px solid rgba(255,255,255,0.03);
  font-size: 13px; align-items: center; position: relative;
  cursor: pointer; outline: none;
}
.pt-item:hover { background: rgba(255,255,255,0.03); }
.pt-item:focus-visible { box-shadow: inset 2px 0 0 var(--blue); }

.pt-current { background: rgba(59,130,246,0.04); }

.pt-dot {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  width: 8px; height: 8px; border-radius: 50%; border: 2px solid var(--border); background: var(--bg-primary);
}

.pt-dot.active {
  border-color: var(--blue); background: var(--blue);
  box-shadow: 0 0 8px var(--blue-glow);
}

.pt-time { color: var(--text-secondary); }
.pt-pos { font-family: 'Courier New', monospace; font-size: 12px; color: var(--text-secondary); }
.pt-wind { font-weight: 600; }

.loading-state, .state-wrap {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; min-height: 300px;
}
.center-row { display: flex; justify-content: center; }
</style>
