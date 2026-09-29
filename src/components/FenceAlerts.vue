<template>
  <div class="fence glass-card">
    <div class="fe-header">
      <span class="section-title">地理围栏告警</span>
      <span class="fe-count" v-if="alerts.length">{{ alerts.length }} 条</span>
      <button type="button" class="fe-toggle" @click="showManage = !showManage">
        {{ showManage ? '收起' : '管理关注城市' }}
      </button>
    </div>

    <!-- 关注城市管理 -->
    <div v-if="showManage" class="fe-manage">
      <p class="fe-hint">
        点击城市加入 / 移出关注。关注城市进入活跃台风风圈时将在此自动告警；刷新后保留。
      </p>
      <div class="fe-chips">
        <button
          v-for="c in allCities()"
          :key="c.name"
          type="button"
          class="fe-chip"
          :class="{ 'is-on': isWatched(c.name) }"
          :aria-pressed="isWatched(c.name)"
          @click="toggle(c.name)"
        >
          {{ c.name }}
        </button>
      </div>
      <p v-if="unmatched.length" class="fe-warn">
        以下城市暂无坐标数据，不参与围栏计算：{{ unmatched.join('、') }}
      </p>
      <button v-if="watched.length" type="button" class="fe-clear" @click="clear">
        清空关注（{{ watched.length }}）
      </button>
    </div>

    <!-- 引导态 / 空态 -->
    <div v-if="!watched.length" class="fe-guide">
      尚未设置关注城市。添加后，当其进入活跃台风风圈时会在此自动告警。
    </div>
    <div v-else-if="!hasActiveTyphoon" class="fe-guide">
      当前无活跃台风，围栏处于待命状态 —— 一旦有活跃台风进入关注城市附近将立即告警。
    </div>
    <div v-else-if="!alerts.length" class="fe-guide">
      当前无围栏告警 —— 关注城市均未进入活跃台风风圈，且都不在临界范围内。
    </div>

    <!-- 告警列表 -->
    <div v-else class="fe-list">
      <div class="fe-item" v-for="(a, i) in alerts" :key="i">
        <span class="warn-tag" :class="`warn-${a.level}`">{{ a.label }}</span>
        <!-- 城市名可点击 → 请求地图定位。
             父组件决定"定位到哪里"：有地图就定位，没地图就跳转；
             组件本身不发路由、不臆造行为。 -->
        <button
          type="button"
          class="fe-city"
          :aria-label="`在地图上定位 ${a.city}`"
          @click="locate(a.city)"
        >{{ a.city }}</button>
        <span class="fe-desc">
          {{ a.typhoonName }} · 最近 {{ distanceText(a.distanceKm) }}
          <em v-if="a.nearestPoint">
            （{{ formatDateTime(a.nearestPoint.time) }} {{ a.isFuture ? '预报' : '已发生' }}）
          </em>
        </span>
        <router-link :to="`/typhoon/${a.typhoonId}`" class="fe-link">详情 →</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useWatchedCities } from '../composables/useWatchedCities'
import { findCity } from '../constants/cities'
import { assessCityImpact } from '../utils/geo'
import { formatDateTime } from '../utils/format'

const props = defineProps({
  /** 参与围栏计算的台风（调用方应只传活跃台风） */
  typhoons: { type: Array, default: () => [] }
})

/** 定位请求：带坐标则请求定位，未收录只带 name，由父组件提示 */
const emit = defineEmits(['locate'])

const { watched, isWatched, toggle, clear, allCities } = useWatchedCities()
const showManage = ref(false)

const activeTyphoons = computed(() =>
  (Array.isArray(props.typhoons) ? props.typhoons : []).filter((t) => t && t.status === 'active')
)
const hasActiveTyphoon = computed(() => activeTyphoons.value.length > 0)

/** 关注了但坐标表未收录的城市：必须明确告知用户，否则会以为"已关注但不告警"是 bug */
const unmatched = computed(() => watched.value.filter((n) => !findCity(n)))

const alerts = computed(() => {
  const cities = watched.value.map((n) => findCity(n)).filter(Boolean)
  if (!cities.length || !hasActiveTyphoon.value) return []

  const out = []
  activeTyphoons.value.forEach((t) => {
    cities.forEach((city) => {
      const a = assessCityImpact(t, city)
      if (!a) return

      if (a.ring) {
        out.push({
          city: city.name,
          typhoonId: t.id,
          typhoonName: t.name,
          distanceKm: a.nearestKm,
          nearestPoint: a.nearestPoint,
          isFuture: a.isFuture,
          level: a.ring.level,
          label: `位于${a.ring.label}内`,
          order: 0
        })
        return
      }

      // 临界：未入圈但已接近 7 级风圈，提前提醒而非等进了圈才知道
      const r7 = Number(t.radius7)
      if (Number.isFinite(r7) && r7 > 0 && a.nearestKm !== null && a.nearestKm <= r7 * 1.3) {
        out.push({
          city: city.name,
          typhoonId: t.id,
          typhoonName: t.name,
          distanceKm: a.nearestKm,
          nearestPoint: a.nearestPoint,
          isFuture: a.isFuture,
          level: 'blue',
          label: '接近风圈',
          order: 1
        })
      }
    })
  })

  // 已入圈的排前面，同级按距离由近到远
  return out.sort((x, y) => x.order - y.order || (x.distanceKm ?? 0) - (y.distanceKm ?? 0))
})

function locate(name) {
  const city = findCity(name)
  emit('locate', city ? { ...city } : { name, missing: true })
}

function distanceText(km) {
  if (km === null || km === undefined || Number.isNaN(Number(km))) return '—'
  return `${Math.round(Number(km))} km`
}
</script>

<style scoped>
.fence { padding: 14px 16px; }

.fe-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.fe-count {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.fe-toggle {
  margin-left: auto;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
}
.fe-toggle:hover { border-color: var(--blue); color: var(--blue); }

.fe-manage {
  padding: 12px;
  margin-bottom: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.fe-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}
.fe-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.fe-chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
}
.fe-chip:hover { border-color: var(--blue); }
.fe-chip.is-on {
  background: rgba(59, 130, 246, 0.18);
  border-color: var(--blue);
  color: var(--blue);
  font-weight: 600;
}
.fe-warn {
  margin: 10px 0 0;
  font-size: 12px;
  color: #fbbf24;
  line-height: 1.6;
}
.fe-clear {
  margin-top: 10px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.fe-clear:hover { border-color: var(--red); color: #f87171; }

.fe-guide {
  padding: 14px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}

.fe-list { display: flex; flex-direction: column; gap: 8px; }
.fe-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-sm);
  font-size: 13px;
  flex-wrap: wrap;
}
.fe-city {
  font-weight: 600;
  font-size: 13px;
  font-family: inherit;
  color: var(--text-primary);
  background: none;
  border: none;
  border-bottom: 1px dashed transparent;
  padding: 0;
  cursor: pointer;
  transition: all var(--transition);
}
.fe-city:hover { color: #22d3ee; border-bottom-color: #22d3ee; }
.fe-city:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.fe-desc { color: var(--text-secondary); }
.fe-desc em { font-style: normal; color: var(--text-muted); font-size: 12px; }
.fe-link {
  margin-left: auto;
  font-size: 12px;
  color: var(--blue);
  text-decoration: none;
}
.fe-link:hover { text-decoration: underline; }
</style>
