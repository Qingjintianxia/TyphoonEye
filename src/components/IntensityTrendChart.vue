<template>
  <div class="itc">
    <div v-if="count > 1" class="itc-chart">
      <svg :viewBox="`0 0 ${W} ${H}`" class="itc-svg" role="img"
           :aria-label="`强度演变曲线，共 ${count} 个路径点，风速 ${minWind} 至 ${maxWind} m/s`">
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--blue)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--blue)" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <!-- 网格与 Y 轴刻度 -->
        <g class="itc-grid">
          <template v-for="g in gridLines" :key="g.y">
            <line :x1="PLOT.left" :y1="g.y" :x2="PLOT.right" :y2="g.y" />
            <text :x="PLOT.left - 8" :y="g.y + 4" class="itc-axis-label">{{ g.label }}</text>
          </template>
        </g>

        <!-- 面积 + 折线 -->
        <path :d="areaPath" :fill="`url(#${gradientId})`" />
        <path :d="linePath" class="itc-line" />

        <!-- 实况/预报分界 -->
        <line
          v-if="showRealtimeSplit"
          :x1="xOf(realtimeIndex)" :y1="PLOT.top - 6"
          :x2="xOf(realtimeIndex)" :y2="PLOT.bottom"
          class="itc-split"
        />
        <text
          v-if="showRealtimeSplit"
          :x="xOf(realtimeIndex) + 6" :y="PLOT.top + 2"
          class="itc-split-label"
        >当前</text>

        <!-- 数据点 -->
        <circle
          v-for="(p, i) in points" :key="i"
          :cx="xOf(i)" :cy="yOf(windOf(p))" r="3.5"
          :fill="levelColor(p.level)"
        />

        <!-- 当前回放点 -->
        <line
          v-if="hasCurrent"
          :x1="xOf(index)" :y1="PLOT.top - 6"
          :x2="xOf(index)" :y2="PLOT.bottom"
          class="itc-cursor"
        />
        <circle
          v-if="hasCurrent"
          :cx="xOf(index)" :cy="yOf(currentWind)" r="6"
          :fill="levelColor(points[index].level)"
          class="itc-current"
        />
        <text
          v-if="hasCurrent"
          :x="clampX(xOf(index))" :y="Math.max(PLOT.top - 2, yOf(currentWind) - 12)"
          class="itc-current-label"
        >{{ Math.round(currentWind) }} m/s</text>

        <!-- X 轴首末时间 -->
        <text :x="PLOT.left" :y="H - 8" class="itc-axis-label">{{ shortTime(points[0].time) }}</text>
        <text :x="PLOT.right" :y="H - 8" class="itc-axis-label itc-end">
          {{ shortTime(points[count - 1].time) }}
        </text>
      </svg>
    </div>

    <div v-else-if="count === 1" class="itc-empty">仅 1 个路径点，无法绘制演变曲线</div>
    <div v-else class="itc-empty">暂无路径数据</div>

    <div class="itc-legend">
      <span><i class="itc-dot" style="background:#3b82f6"></i>风速 m/s</span>
      <span class="itc-legend-note">数据点颜色代表该时刻强度等级</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { levelColor } from '../constants/typhoon'
import { parseTime } from '../utils/format'

const props = defineProps({
  points: { type: Array, default: () => [] },
  index: { type: Number, default: 0 },
  realtimeIndex: { type: Number, default: -1 }
})

const W = 640
const H = 200
const PLOT = { top: 20, bottom: 168, left: 46, right: 624 }

// 同页面可能存在多个实例，渐变 id 必须唯一，否则后渲染的会覆盖前一个
const gradientId = `itc-grad-${Math.random().toString(36).slice(2, 9)}`

const points = computed(() => (Array.isArray(props.points) ? props.points : []))
const count = computed(() => points.value.length)

function windOf(p) {
  const n = Number(p && p.wind)
  return Number.isFinite(n) ? n : 0
}

const winds = computed(() => points.value.map(windOf).filter((v) => Number.isFinite(v)))
const minWind = computed(() => (winds.value.length ? Math.min(...winds.value) : 0))
const maxWind = computed(() => (winds.value.length ? Math.max(...winds.value) : 0))

const hasCurrent = computed(() => count.value > 0 && props.index >= 0 && props.index < count.value)
const currentWind = computed(() => (hasCurrent.value ? windOf(points.value[props.index]) : 0))

const showRealtimeSplit = computed(
  () => props.realtimeIndex >= 0 && props.realtimeIndex < count.value - 1
)

function xOf(i) {
  if (count.value <= 1) return (PLOT.left + PLOT.right) / 2
  const span = PLOT.right - PLOT.left
  return PLOT.left + (i / (count.value - 1)) * span
}

function yOf(w) {
  const span = maxWind.value - minWind.value || 1
  const ratio = (w - minWind.value) / span
  return PLOT.bottom - ratio * (PLOT.bottom - PLOT.top)
}

/** 首尾标签留出边距 */
function clampX(x) {
  return Math.min(PLOT.right - 28, Math.max(PLOT.left + 4, x))
}

const linePath = computed(() =>
  points.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(windOf(p)).toFixed(1)}`)
    .join(' ')
)

const areaPath = computed(() => {
  if (count.value < 2) return ''
  return `${linePath.value} L${xOf(count.value - 1).toFixed(1)},${PLOT.bottom} L${xOf(0).toFixed(1)},${PLOT.bottom} Z`
})

const gridLines = computed(() => {
  const rows = 4
  const out = []
  for (let k = 0; k <= rows; k++) {
    const y = PLOT.top + ((PLOT.bottom - PLOT.top) * k) / rows
    const w = maxWind.value - (maxWind.value - minWind.value) * (k / rows)
    out.push({ y: y.toFixed(1), label: Math.round(w) })
  }
  return out
})

/** X 轴只展示 月-日 时:分 */
function shortTime(value) {
  const d = parseTime(value)
  if (!d) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.itc { width: 100%; }
.itc-chart { width: 100%; }
.itc-svg { width: 100%; height: auto; display: block; overflow: visible; }

.itc-grid line {
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1;
}

.itc-axis-label {
  fill: var(--text-muted);
  font-size: 10px;
  text-anchor: end;
}
.itc-axis-label.itc-end { text-anchor: end; }

.itc-line {
  fill: none;
  stroke: var(--blue);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.itc-split {
  stroke: rgba(16, 185, 129, 0.55);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.itc-split-label {
  fill: #34d399;
  font-size: 10px;
}

.itc-cursor {
  stroke: rgba(255, 255, 255, 0.35);
  stroke-width: 1;
  stroke-dasharray: 2 3;
}

.itc-current {
  stroke: #fff;
  stroke-width: 2;
}

.itc-current-label {
  fill: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  text-anchor: middle;
}

.itc-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.itc-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
.itc-legend span { display: inline-flex; align-items: center; gap: 6px; }
.itc-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.itc-legend-note { color: var(--text-muted); }
</style>
