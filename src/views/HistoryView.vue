<template>
  <div>
    <h1 class="page-title">历史数据</h1>
    <p class="page-subtitle">历年台风统计与趋势分析</p>

    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="error" class="state-wrap">
      <ErrorState title="历史统计加载失败" :description="error" @retry="loadStats" />
    </div>

    <template v-else>
      <!-- Yearly Summary -->
      <div class="stats-grid">
        <div class="stat-card glass-card">
          <div class="ss-label">历史台风总数</div>
          <div class="ss-value">{{ typhoonStore.historicalTyphoons.length }}</div>
          <div class="ss-sub">历年累计</div>
        </div>
        <div class="stat-card glass-card">
          <div class="ss-label">超强台风数</div>
          <div class="ss-value red">{{ superTyphoonCount }}</div>
          <div class="ss-sub">占比 {{ superTyphoonPercent }}%</div>
        </div>
        <div class="stat-card glass-card">
          <div class="ss-label">登陆台风数</div>
          <div class="ss-value orange">{{ landedCount }}</div>
          <div class="ss-sub">影响沿海地区</div>
        </div>
        <div class="stat-card glass-card">
          <div class="ss-label">平均最大风速</div>
          <div class="ss-value blue">{{ avgWindSpeed }} <span style="font-size:14px;font-weight:400;">m/s</span></div>
          <div class="ss-sub">历史统计</div>
        </div>
      </div>

      <!-- Charts -->
      <div class="content-grid" style="margin-bottom: 28px;">
        <Charts title="台风强度分布" :option="yearPieOption" :height="320" />
        <Charts title="历年台风数量趋势" :option="trendOption" :height="320" />
      </div>

      <!-- Historical Typhoon Table -->
      <TyphoonTable title="历史台风记录" :typhoons="typhoonStore.historicalTyphoons" :showMore="false" />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import Charts from '../components/Charts.vue'
import TyphoonTable from '../components/TyphoonTable.vue'
import ErrorState from '../components/ErrorState.vue'
import { useTyphoonStore } from '../stores/typhoon'
import { http } from '../utils/request'
import { levelColor } from '../constants/typhoon'

const typhoonStore = useTyphoonStore()

const loading = ref(false)
const error = ref('')
const stats = ref({ levelDistribution: [], yearTrend: [] })

const historicalTyphoons = computed(() => typhoonStore.historicalTyphoons)
const superTyphoonCount = computed(() =>
  historicalTyphoons.value.filter((t) => t.level === '超强台风' || t.level === '强台风').length
)
const superTyphoonPercent = computed(() =>
  historicalTyphoons.value.length
    ? Math.round((superTyphoonCount.value / historicalTyphoons.value.length) * 100)
    : 0
)
const landedCount = computed(() =>
  historicalTyphoons.value.filter((t) => (t.affectedCities || []).length > 2).length
)
const avgWindSpeed = computed(() => {
  if (!historicalTyphoons.value.length) return 0
  const sum = historicalTyphoons.value.reduce((s, t) => s + (t.windSpeed || 0), 0)
  return Math.round(sum / historicalTyphoons.value.length)
})

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const data = await http.get('/statistics')
    stats.value = { ...stats.value, ...(data || {}) }
  } catch (e) {
    if (!e?.isUnauthorized) error.value = e?.message || '历史统计加载失败'
  } finally {
    loading.value = false
  }
}

const yearPieOption = computed(() => ({
  tooltip: { trigger: 'item' },
  series: [
    {
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['50%', '55%'],
      roseType: 'area',
      itemStyle: { borderRadius: 4, borderColor: '#0f1923', borderWidth: 2 },
      label: { color: '#8899aa', fontSize: 12 },
      data: (stats.value.levelDistribution || []).map((d) => ({
        ...d,
        itemStyle: { color: levelColor(d.name) }
      }))
    }
  ]
}))

const trendOption = computed(() => {
  const trend = stats.value.yearTrend || []
  const years = trend.map((y) => y.year)
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['台风总数', '超强/强台风'], textStyle: { color: '#8899aa' }, top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
    xAxis: {
      type: 'category',
      data: years,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { color: '#8899aa' }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      axisLabel: { color: '#8899aa' }
    },
    series: [
      {
        name: '台风总数',
        type: 'line',
        data: trend.map((y) => y.total),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#3b82f6', width: 3 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59,130,246,0.2)' },
              { offset: 1, color: 'rgba(59,130,246,0.02)' }
            ]
          }
        }
      },
      {
        name: '超强/强台风',
        type: 'line',
        data: trend.map((y) => y.super),
        smooth: true,
        symbol: 'diamond',
        symbolSize: 8,
        lineStyle: { color: '#ef4444', width: 2, type: 'dashed' },
        itemStyle: { color: '#ef4444' }
      }
    ]
  }
})

onMounted(loadStats)
</script>

<style scoped>
.stat-card {
  padding: 24px; text-align: center;
}

.ss-label {
  font-size: 12px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
}

.ss-value {
  font-size: 36px; font-weight: 700; letter-spacing: -1px; margin-bottom: 4px;
}

.ss-value.red { color: var(--red); }
.ss-value.orange { color: var(--orange); }
.ss-value.blue { color: var(--blue); }

.ss-sub {
  font-size: 12px; color: var(--text-muted);
}

.loading-state, .state-wrap {
  text-align: center; color: var(--text-muted); font-size: 14px; padding: 60px 0;
}
</style>
