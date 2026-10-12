<template>
  <div class="impact-panel">
    <div class="ip-picker">
      <label class="ip-label" for="ip-city">评估城市</label>
      <select id="ip-city" class="ip-select" v-model="selectedCityName" @change="locateSelected">
        <option v-for="c in cityOptions" :key="c.name" :value="c.name">
          {{ c.name }}{{ isAffected(c.name) ? '（受影响）' : '' }}
        </option>
      </select>
    </div>

    <!-- 城市未收录：明确提示，不给出任何距离数字 -->
    <div v-if="!selectedCity" class="ip-missing">
      暂未收录该城市坐标，无法进行距离评估。可选择其它城市，或在城市表中补充坐标后再评估。
    </div>

    <template v-else-if="assessment">
      <div class="ip-grid">
        <div class="ip-cell">
          <span class="ip-cell-label">当前距离</span>
          <span class="ip-cell-value">{{ distanceText(assessment.currentKm) }}</span>
        </div>
        <div class="ip-cell">
          <span class="ip-cell-label">最近距离</span>
          <span class="ip-cell-value ip-accent">{{ distanceText(assessment.nearestKm) }}</span>
          <span class="ip-cell-sub" v-if="assessment.nearestPoint">
            {{ formatDateTime(assessment.nearestPoint.time) }}
            <em :class="assessment.isFuture ? 'ip-future' : 'ip-past'">
              {{ assessment.isFuture ? '预报' : '已发生' }}
            </em>
          </span>
          <span class="ip-cell-sub" v-else>无路径数据，无法计算最近距离</span>
        </div>
        <div class="ip-cell">
          <span class="ip-cell-label">风圈状态</span>
          <span class="ip-cell-value ip-ring" v-if="assessment.ring">
            位于 {{ assessment.ring.label }} 内
          </span>
          <span class="ip-cell-value" v-else>不在风圈范围内</span>
          <span class="ip-cell-sub" v-if="assessment.ring">
            半径 {{ assessment.ring.radiusKm }} km
          </span>
        </div>
        <div class="ip-cell">
          <span class="ip-cell-label">风险等级</span>
          <span
            class="warn-tag is-lg"
            :class="assessment.risk.warn ? `warn-${assessment.risk.warn}` : ''"
          >{{ assessment.risk.label }}</span>
        </div>
      </div>

      <p class="ip-advice">{{ assessment.risk.advice }}</p>

      <!-- 该台风影响城市逐城摘要 -->
      <div class="ip-affected" v-if="affectedRows.length">
        <div class="ip-subtitle">影响城市评估</div>
        <div class="ip-rows">
          <!-- 城市行必须可点击：点了要能把地图定位过去。
               用 button 而非 div —— 可聚焦、可键盘触发，且能表达"当前已定位"。 -->
          <button
            type="button"
            class="ip-row"
            v-for="row in affectedRows"
            :key="row.name"
            :class="{ 'is-active': row.name === locatedName }"
            :aria-pressed="row.name === locatedName"
            :aria-label="`在地图上定位 ${row.name}`"
            @click="locate(row.name)"
          >
            <span class="ip-row-name">{{ row.name }}</span>
            <template v-if="row.assessment">
              <span class="ip-row-dist">{{ distanceText(row.assessment.nearestKm) }}</span>
              <span
                class="warn-tag"
                :class="row.assessment.risk.warn ? `warn-${row.assessment.risk.warn}` : ''"
              >{{ row.assessment.risk.label }}</span>
            </template>
            <span v-else class="ip-row-missing">坐标未收录</span>
            <span class="ip-row-pin">定位</span>
          </button>
        </div>
      </div>
      <p v-else class="ip-empty">暂无明确影响城市，可自行选择城市评估。</p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { allCities, findCity, canonicalCityName } from '../constants/cities'
import { assessCityImpact } from '../utils/geo'
import { formatDateTime, safeList } from '../utils/format'

const props = defineProps({
  typhoon: { type: Object, default: null },
  /** 当前已定位的城市名（由父组件回传，用于行高亮）；空串表示未定位 */
  locatedName: { type: String, default: '' }
})

/**
 * 定位请求：带坐标则请求定位，未收录则只带 name 让父组件提示。
 * 未收录的城市不做定位。
 */
const emit = defineEmits(['locate'])

const selectedCityName = ref('')

/** 受影响城市名（别名已归一到标准名，如「香港」→「中国香港」） */
const affectedNames = computed(() =>
  safeList(props.typhoon?.affectedCities).map((n) => canonicalCityName(n))
)

/** 受影响城市排在前，其余城市按纬度降序补充 */
const cityOptions = computed(() => {
  const affected = affectedNames.value.map((n) => findCity(n)).filter(Boolean)
  const seen = new Set(affected.map((c) => c.name))
  return [...affected, ...allCities().filter((c) => !seen.has(c.name))]
})

function isAffected(name) {
  return affectedNames.value.includes(name)
}

// 切换台风时默认选中第一个已收录的受影响城市
watch(
  () => props.typhoon,
  (t) => {
    const first = safeList(t?.affectedCities).map((n) => findCity(n)).find(Boolean)
    selectedCityName.value = first ? first.name : cityOptions.value[0]?.name || ''
  },
  { immediate: true }
)

const selectedCity = computed(() => findCity(selectedCityName.value))
const assessment = computed(() =>
  selectedCity.value ? assessCityImpact(props.typhoon, selectedCity.value) : null
)

const affectedRows = computed(() =>
  affectedNames.value.map((name) => {
    const city = findCity(name)
    return {
      name,
      assessment: city ? assessCityImpact(props.typhoon, city) : null
    }
  })
)

/** 点击城市行 → 请求地图定位 */
function locate(name) {
  const city = findCity(name)
  emit('locate', city ? { ...city } : { name, missing: true })
}

/** 下拉切换城市时同步定位 */
function locateSelected() {
  locate(selectedCityName.value)
}

function distanceText(km) {
  if (km === null || km === undefined || Number.isNaN(Number(km))) return '—'
  return `${Math.round(Number(km))} km`
}
</script>

<style scoped>
.impact-panel { width: 100%; }

.ip-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.ip-label { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.ip-select {
  flex: 1;
  padding: 7px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}
.ip-select:focus { border-color: var(--blue); }

.ip-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.ip-cell {
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.ip-cell-label { font-size: 11px; color: var(--text-muted); }
.ip-cell-value { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ip-cell-value.ip-accent { color: var(--blue); }
.ip-cell-value.ip-ring { font-size: 14px; font-weight: 600; }
.ip-cell-sub { font-size: 11px; color: var(--text-muted); }
.ip-cell-sub em { font-style: normal; margin-left: 4px; }
.ip-future { color: #a78bfa; }
.ip-past { color: #34d399; }

.ip-advice {
  margin: 0 0 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 3px solid var(--blue);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.ip-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.ip-rows { display: flex; flex-direction: column; gap: 6px; }
.ip-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-primary);
  font-family: inherit;
  text-align: left;
  width: 100%;
  cursor: pointer;
  transition: all var(--transition);
}
.ip-row:hover { background: rgba(59, 130, 246, 0.08); border-color: var(--blue); }
.ip-row:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
.ip-row.is-active {
  background: rgba(34, 211, 238, 0.12);
  border-color: #22d3ee;
}
.ip-row-pin {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity var(--transition);
}
.ip-row:hover .ip-row-pin, .ip-row.is-active .ip-row-pin { opacity: 1; color: #22d3ee; }
.ip-row-name { font-weight: 600; min-width: 56px; }
.ip-row-dist {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  margin-right: auto;
}
.ip-row-missing { font-size: 12px; color: var(--text-muted); }

.ip-missing {
  padding: 16px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: #fbbf24;
  line-height: 1.6;
}

.ip-empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
