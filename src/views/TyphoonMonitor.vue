<template>
  <div class="monitor-page">
    <div class="mp-header">
      <div>
        <h1 class="page-title">台风监控</h1>
        <p class="page-subtitle">实时追踪活跃台风路径与强度变化</p>
      </div>
      <router-link to="/compare" class="btn">路径对比 →</router-link>
    </div>

    <div v-if="typhoonStore.loading" class="loading-state">加载中...</div>
    <div v-else-if="typhoonStore.error" class="state-wrap">
      <ErrorState
        :title="'台风数据加载失败'"
        :description="typhoonStore.error"
        @retry="typhoonStore.fetchTyphoons()"
      />
    </div>

    <template v-else>
      <!-- 筛选栏：搜索 / 强度 / 预警 / 状态 / 排序，作用于下方地图与列表 -->
      <TyphoonFilterBar
        v-model:query="query"
        :total="typhoonStore.typhoons.length"
        :count="result.length"
        :filtered="filtered"
        class="monitor-filter"
        @toggle-level="toggleLevel"
        @toggle-warning="toggleWarning"
      />

      <!-- 地理围栏告警：只对活跃台风计算，前端派生，不与后端 alerts 混排 -->
      <FenceAlerts :typhoons="typhoonStore.typhoons" class="monitor-fence" @locate="locateCity" />

      <div class="monitor-layout">
        <div class="monitor-map">
          <TyphoonMap
            :typhoons="mapTyphoons"
            :selectedId="selectedId"
            :focus-city="focusCity"
            :focus-seq="focusSeq"
            @select="handleSelect"
          />
        </div>

        <div class="monitor-sidebar">
          <div class="glass-card" style="padding: 16px 20px; margin-bottom: 16px;">
            <div class="section-header">
              <span class="section-title">台风列表</span>
              <span class="badge badge-red">{{ result.length }} 个</span>
            </div>
          </div>

          <div v-if="!result.length" class="empty-state glass-card">
            <p>{{ filtered ? '没有符合条件的台风' : '当前没有台风数据' }}</p>
            <button v-if="filtered" type="button" class="btn" @click="reset">清除筛选</button>
          </div>

          <div class="typhoon-cards" v-else>
            <div class="typhoon-card glass-card"
                 v-for="t in result" :key="t.id"
                 :class="{ selected: selectedId === t.id }"
                 @click="handleSelect(t.id)">
              <div class="tc-header">
                <div class="tc-name">
                  <span class="tc-name-cn">{{ t.name }}</span>
                  <span class="tc-name-en">{{ t.nameEn }}</span>
                </div>
                <span class="badge" :class="levelBadgeClass(t.level)">{{ t.level }}</span>
              </div>
              <div class="tc-stats">
                <div class="tc-stat">
                  <span class="tc-stat-value">{{ formatNumber(t.windSpeed) }}</span>
                  <span class="tc-stat-unit">m/s</span>
                </div>
                <div class="tc-stat">
                  <span class="tc-stat-value">{{ formatNumber(t.pressure) }}</span>
                  <span class="tc-stat-unit">hPa</span>
                </div>
                <div class="tc-stat">
                  <span class="tc-stat-value">{{ formatNumber(t.radius7) }}</span>
                  <span class="tc-stat-unit">km(7级)</span>
                </div>
              </div>
              <div class="tc-footer">
                <span class="warn-tag" :class="`warn-${t.warningLevel}`">
                  {{ warningLabel(t.warningLevel) }}
                </span>
                <span class="tc-time">{{ formatDateTime(t.updateTime) }}</span>
              </div>
              <div class="tc-coords">
                {{ formatCoord(t.latitude, t.longitude) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import TyphoonMap from '../components/TyphoonMap.vue'
import TyphoonFilterBar from '../components/TyphoonFilterBar.vue'
import FenceAlerts from '../components/FenceAlerts.vue'
import { useTyphoonStore } from '../stores/typhoon'
import { findCity } from '../constants/cities'
import { levelBadgeClass, warningLabel } from '../constants/typhoon'
import { formatNumber, formatDateTime, formatCoord } from '../utils/format'
import { useTyphoonFilter } from '../composables/useTyphoonFilter'
import { toast } from '../utils/toast'
import ErrorState from '../components/ErrorState.vue'

const typhoonStore = useTyphoonStore()
const route = useRoute()
const selectedId = ref('')

/**
 * 城市定位：地图自身不持有业务状态，由页面决定定位目标。
 * focusSeq 自增用于"同一城市再次点击"时强制重新触发 watch。
 */
const focusCity = ref(null)
const focusSeq = ref(0)

function locateCity(city) {
  if (!city || city.missing || !Number.isFinite(Number(city.lat))) {
    toast.warning(`${city?.name || '该城市'}暂未收录坐标，无法在地图上定位`)
    return
  }
  focusCity.value = focusCity.value?.name === city.name ? null : { ...city }
  focusSeq.value += 1
}

// 深链：/monitor?focus=城市名 —— 预警中心没有地图，点击城市时跳过来并定位
onMounted(() => {
  const name = typeof route.query.focus === 'string' ? route.query.focus : ''
  if (!name) return
  const city = findCity(name)
  if (!city) {
    toast.warning(`${name}暂未收录坐标，无法在地图上定位`)
    return
  }
  focusCity.value = { ...city }
  focusSeq.value += 1
})

// 监控页默认只关注活跃台风（页面级初始条件），用户可自行切到"全部/已结束"
const { query, result, filtered, reset, toggleLevel, toggleWarning } = useTyphoonFilter(
  () => typhoonStore.typhoons,
  { status: 'active' }
)

const mapTyphoons = computed(() => result.value)

function handleSelect(id) {
  selectedId.value = id
}
</script>

<style scoped>
.monitor-page { height: 100%; display: flex; flex-direction: column; }
.mp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.monitor-filter { margin-bottom: 16px; }
.monitor-fence { margin-bottom: 16px; }
.monitor-layout { flex: 1; display: flex; gap: 20px; min-height: 0; }
.monitor-map { flex: 1; min-width: 0; }
.monitor-sidebar { width: 320px; overflow-y: auto; }

.typhoon-cards { display: flex; flex-direction: column; gap: 12px; }
.typhoon-card { padding: 16px; cursor: pointer; }
.typhoon-card.selected { border-color: var(--blue); box-shadow: 0 0 16px var(--blue-glow); }

.tc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.tc-name-cn { font-weight: 700; font-size: 16px; display: block; }
.tc-name-en { font-size: 11px; color: var(--text-muted); }

.tc-stats { display: flex; gap: 16px; margin-bottom: 12px; }
.tc-stat { text-align: center; }
.tc-stat-value { font-size: 20px; font-weight: 700; display: block; line-height: 1.1; font-variant-numeric: tabular-nums; }
.tc-stat-unit { font-size: 11px; color: var(--text-muted); }

.tc-footer { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.tc-time { font-size: 11px; color: var(--text-muted); }
.tc-coords { font-size: 11px; color: var(--text-muted); font-family: 'Courier New', monospace; }

.empty-state {
  text-align: center; color: var(--text-muted);
  padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.empty-state p { margin: 0; }

.state-wrap { padding: 40px 0; }
.loading-state { text-align: center; color: var(--text-muted); font-size: 14px; padding: 60px; }
</style>
