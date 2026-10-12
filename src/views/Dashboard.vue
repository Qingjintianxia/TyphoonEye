<template>
  <div>
    <h1 class="page-title">仪表盘</h1>
    <p class="page-subtitle">台风预警系统实时监控总览</p>

    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="error" class="state-wrap">
      <ErrorState
        title="统计概览加载失败"
        :description="error"
        :loading="loading"
        @retry="loadStats"
      />
    </div>

    <template v-else>
      <!-- Stats Cards -->
      <div class="stats-grid">
        <StatCard label="活跃台风" :value="stats.activeCount" variant="red">
          <template #icon>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 2a10 10 0 0 0 0 20"/>
            </svg>
          </template>
        </StatCard>
        <StatCard label="预警总数" :value="stats.alertCount" variant="orange">
          <template #icon>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </template>
        </StatCard>
        <StatCard label="红色预警" :value="stats.redAlertCount" variant="red">
          <template #icon>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="12 2 22 22 2 22"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="19" r="0.5"/>
            </svg>
          </template>
        </StatCard>
        <StatCard label="受影响城市" :value="stats.affectedCityCount" variant="blue">
          <template #icon>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </template>
        </StatCard>
      </div>

      <!-- Charts Row -->
      <div class="content-grid" style="margin-bottom: 28px;">
        <Charts title="台风强度分布" :option="pieOption" :height="300" />
        <Charts title="月度台风频次" :option="barOption" :height="300" />
      </div>

      <!-- Active Typhoon List -->
      <div style="margin-bottom: 28px;">
        <TyphoonTable title="活跃台风" :typhoons="activeTyphoons" />
      </div>

      <!-- Alerts -->
      <AlertPanel title="最新预警" :alerts="latestAlerts" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import StatCard from '../components/StatCard.vue'
import Charts from '../components/Charts.vue'
import TyphoonTable from '../components/TyphoonTable.vue'
import AlertPanel from '../components/AlertPanel.vue'
import { useTyphoonStore } from '../stores/typhoon'
import { useAlertStore } from '../stores/alert'
import { http } from '../utils/request'
import { levelColor } from '../constants/typhoon'
import ErrorState from '../components/ErrorState.vue'

const typhoonStore = useTyphoonStore()
const alertStore = useAlertStore()

const stats = ref({
  activeCount: 0, alertCount: 0, redAlertCount: 0, affectedCityCount: 0,
  monthlyData: [], levelDistribution: []
})
const loading = ref(false)
const error = ref('')

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const data = await http.get('/statistics')
    stats.value = { ...stats.value, ...(data || {}) }
  } catch (e) {
    // 401 由请求层跳转，不展示通用错误文案
    if (!e?.isUnauthorized) error.value = e?.message || '统计概览加载失败'
  } finally {
    loading.value = false
  }
}

const activeTyphoons = computed(() =>
  typhoonStore.activeTyphoonsByLevel
)

const latestAlerts = computed(() =>
  [...alertStore.alerts].slice(0, 6)
)

const pieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  series: [{
    type: 'pie',
    radius: ['55%', '80%'],
    center: ['50%', '55%'],
    itemStyle: { borderRadius: 4, borderColor: '#0f1923', borderWidth: 3 },
    label: { color: '#8899aa', fontSize: 12 },
    data: (stats.value.levelDistribution || []).map(d => ({
      ...d,
      itemStyle: { color: levelColor(d.name) }
    }))
  }]
}))

const barOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: {
    type: 'category',
    data: (stats.value.monthlyData || []).map(d => d.month),
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    axisLabel: { color: '#8899aa', fontSize: 11 }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    axisLabel: { color: '#8899aa' }
  },
  series: [{
    type: 'bar',
    data: (stats.value.monthlyData || []).map(d => d.count),
    itemStyle: {
      borderRadius: [6, 6, 0, 0],
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: '#3b82f6' },
          { offset: 1, color: 'rgba(59,130,246,0.15)' }
        ]
      }
    },
    barWidth: '50%'
  }]
}))

onMounted(loadStats)
</script>
