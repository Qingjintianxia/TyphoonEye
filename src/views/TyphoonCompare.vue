<template>
  <div class="compare-page">
    <h1 class="page-title">路径对比</h1>
    <p class="page-subtitle">选择 2–4 个台风，横向对比路径、强度与影响范围</p>

    <div v-if="typhoonStore.loading" class="loading-state">加载中...</div>
    <div v-else-if="typhoonStore.error" class="state-wrap">
      <ErrorState
        title="台风数据加载失败"
        :description="typhoonStore.error"
        @retry="typhoonStore.fetchTyphoons()"
      />
    </div>

    <template v-else>
      <!-- 选择器 -->
      <div class="glass-card picker">
        <div class="pk-header">
          <span class="section-title">选择台风</span>
          <span class="pk-count">已选 {{ selectedIds.length }} / {{ MAX_COMPARE }}</span>
          <button v-if="selectedIds.length" type="button" class="pk-clear" @click="clearAll">
            清空选择
          </button>
        </div>

        <div class="pk-chips">
          <button
            v-for="t in typhoons"
            :key="t.id"
            type="button"
            class="pk-chip"
            :class="{ 'is-selected': isSelected(t.id) }"
            :aria-pressed="isSelected(t.id)"
            :disabled="!isSelected(t.id) && isFull"
            :title="!isSelected(t.id) && isFull ? '已达上限，请先取消一个' : t.name"
            @click="toggle(t.id)"
          >
            <span class="pk-name">{{ t.name }}</span>
            <span class="badge" :class="levelBadgeClass(t.level)">{{ t.level }}</span>
            <span class="pk-status">{{ statusMeta(t.status).label }}</span>
          </button>
        </div>

        <p v-if="isFull" class="pk-hint">
          已达对比上限（{{ MAX_COMPARE }} 个）。超过 4 条路径叠加会导致地图与曲线不可读，请先取消一个再选。
        </p>
      </div>

      <!-- 引导态 -->
      <div v-if="selected.length < 2" class="glass-card empty-guide">
        <p>请至少选择 <strong>2 个</strong>台风进行对比</p>
        <p class="eg-sub">已选 {{ selected.length }} 个</p>
      </div>

      <template v-else>
        <!-- 指标对比 -->
        <div class="glass-card metric-card">
          <h3 class="section-title" style="margin-bottom: 16px;">指标对比</h3>
          <div class="mt-scroll">
            <table class="cmp-table">
              <thead>
                <tr>
                  <th class="mt-label-col">指标</th>
                  <th v-for="(t, i) in selected" :key="t.id">
                    <i class="cm-dot" :style="{ background: compareColor(i) }"></i>{{ t.name }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="mt-label-col">状态</td>
                  <td v-for="t in selected" :key="t.id">
                    <span class="badge" :class="statusMeta(t.status).badge">
                      {{ statusMeta(t.status).label }}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td class="mt-label-col">强度等级</td>
                  <td v-for="t in selected" :key="t.id">
                    <span class="badge" :class="levelBadgeClass(t.level)">{{ t.level }}</span>
                  </td>
                </tr>
                <tr>
                  <td class="mt-label-col">最大风速</td>
                  <td v-for="t in selected" :key="t.id" :class="{ 'is-best': isBestWind(t) }">
                    {{ formatWind(t.windSpeed) }}
                  </td>
                </tr>
                <tr>
                  <td class="mt-label-col">中心气压</td>
                  <td v-for="t in selected" :key="t.id" :class="{ 'is-best': isBestPressure(t) }">
                    {{ formatPressure(t.pressure) }}
                  </td>
                </tr>
                <tr>
                  <td class="mt-label-col">7 级风圈</td>
                  <td v-for="t in selected" :key="t.id" :class="{ 'is-best': isBestRing(t) }">
                    {{ formatNumber(t.radius7, { unit: 'km' }) }}
                  </td>
                </tr>
                <tr>
                  <td class="mt-label-col">影响城市</td>
                  <td v-for="t in selected" :key="t.id">
                    {{ safeList(t.affectedCities).length || '—' }} 个
                  </td>
                </tr>
                <tr>
                  <td class="mt-label-col">路径点数</td>
                  <td v-for="t in selected" :key="t.id">{{ safeList(t.path).length }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-note">蓝色高亮表示该指标下最强项（风速最大 / 气压最低 / 风圈最大）。</p>
        </div>

        <!-- 路径叠加地图 -->
        <div style="margin-bottom: 28px;">
          <TyphoonCompareMap :typhoons="selected" />
        </div>

        <!-- 风速演变对比 -->
        <div class="glass-card" style="padding: 24px; margin-bottom: 28px;">
          <h3 class="section-title" style="margin-bottom: 16px;">风速演变对比</h3>
          <TyphoonCompareChart :typhoons="selected" />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useTyphoonStore } from '../stores/typhoon'
import {
  MAX_COMPARE,
  compareColor,
  levelBadgeClass,
  statusMeta
} from '../constants/typhoon'
import { formatWind, formatPressure, formatNumber, safeList } from '../utils/format'
import TyphoonCompareMap from '../components/TyphoonCompareMap.vue'
import TyphoonCompareChart from '../components/TyphoonCompareChart.vue'
import ErrorState from '../components/ErrorState.vue'

const typhoonStore = useTyphoonStore()
const selectedIds = ref([])

onMounted(() => {
  if (!typhoonStore.typhoons.length) {
    typhoonStore.fetchTyphoons().catch(() => {})
  }
})

const typhoons = computed(() => typhoonStore.typhoons)
const selected = computed(() =>
  selectedIds.value
    .map((id) => typhoonStore.typhoonById(id))
    .filter(Boolean)
)
const isFull = computed(() => selectedIds.value.length >= MAX_COMPARE)

function isSelected(id) {
  return selectedIds.value.includes(id)
}

function toggle(id) {
  if (isSelected(id)) {
    selectedIds.value = selectedIds.value.filter((v) => v !== id)
    return
  }
  // 达到上限时静默忽略会在 UI 上表现为"点了没反应"，因此按钮已 disabled，这里再兜底
  if (isFull.value) return
  selectedIds.value = [...selectedIds.value, id]
}

function clearAll() {
  selectedIds.value = []
}

// 最强项：用于对比表中突出显示，省去逐格比对数字
const maxWind = computed(() =>
  selected.value.length ? Math.max(...selected.value.map((t) => Number(t.windSpeed) || 0)) : 0
)
const minPressure = computed(() => {
  const vals = selected.value
    .map((t) => Number(t.pressure))
    .filter((v) => Number.isFinite(v) && v > 0)
  return vals.length ? Math.min(...vals) : null
})
const maxRing = computed(() =>
  selected.value.length ? Math.max(...selected.value.map((t) => Number(t.radius7) || 0)) : 0
)

function isBestWind(t) {
  const v = Number(t.windSpeed) || 0
  return v > 0 && v === maxWind.value
}
function isBestPressure(t) {
  const v = Number(t.pressure)
  return Number.isFinite(v) && v > 0 && minPressure.value !== null && v === minPressure.value
}
function isBestRing(t) {
  const v = Number(t.radius7) || 0
  return v > 0 && v === maxRing.value
}
</script>

<style scoped>
.compare-page { padding-bottom: 20px; }

.picker { padding: 16px 20px; margin-bottom: 20px; }
.pk-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 12px; flex-wrap: wrap;
}
.pk-count {
  font-size: 12px; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.pk-clear {
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
.pk-clear:hover { border-color: var(--red); color: #f87171; }

.pk-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.pk-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
}
.pk-chip:hover:not(:disabled) { border-color: var(--blue); color: var(--text-primary); }
.pk-chip.is-selected {
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--blue);
  color: var(--text-primary);
}
.pk-chip:disabled { opacity: 0.4; cursor: not-allowed; }
.pk-name { font-weight: 600; }
.pk-status { font-size: 11px; color: var(--text-muted); }

.pk-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.empty-guide {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary);
}
.empty-guide p { margin: 0; }
.eg-sub { margin-top: 8px; font-size: 12px; color: var(--text-muted); }

.metric-card { padding: 20px; margin-bottom: 28px; }
.mt-scroll { overflow-x: auto; }
.cmp-table { width: 100%; border-collapse: collapse; min-width: 520px; }
.cmp-table th,
.cmp-table td {
  padding: 10px 12px;
  text-align: left;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.cmp-table th {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}
.cmp-table th .cm-dot {
  display: inline-block;
  width: 9px; height: 9px;
  border-radius: 50%;
  margin-right: 6px;
}
.mt-label-col {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}
.cmp-table td.is-best {
  color: var(--blue);
  font-weight: 700;
}
.mt-note {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.state-wrap { padding: 40px 0; }
.loading-state {
  text-align: center; color: var(--text-muted); font-size: 14px; padding: 60px;
}
</style>
