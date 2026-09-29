<template>
  <div class="cmp-chart">
    <div v-if="series.length" class="cc-canvas">
      <svg :viewBox="`0 0 ${W} ${H}`" class="cc-svg" role="img"
           :aria-label="`多台风风速对比曲线，共 ${series.length} 条序列`">
        <!-- 网格与 Y 轴刻度 -->
        <g>
          <template v-for="g in gridLines" :key="g.y">
            <line :x1="PLOT.left" :y1="g.y" :x2="PLOT.right" :y2="g.y" class="cc-grid" />
            <text :x="PLOT.left - 8" :y="g.y + 4" class="cc-axis-label">{{ g.label }}</text>
          </template>
        </g>

        <!-- 各台风序列 -->
        <g v-for="s in series" :key="s.name">
          <path :d="s.d" :stroke="s.color" class="cc-line" />
          <circle
            v-for="(v, i) in s.values" :key="i"
            :cx="xOf(i)" :cy="yOf(v)" r="3" :fill="s.color"
          />
        </g>

        <!-- X 轴说明：按路径点序号对齐 -->
        <text :x="PLOT.left" :y="H - 8" class="cc-axis-label">起点</text>
        <text :x="PLOT.right" :y="H - 8" class="cc-axis-label">终点</text>
      </svg>

      <div class="cc-legend">
        <span v-for="s in series" :key="s.name">
          <i class="cc-dot" :style="{ background: s.color }"></i>{{ s.name }}
        </span>
      </div>
      <p class="cc-note">
        横轴按路径点序号对齐（非绝对时间），便于对比不同生命史长度台风的强度演变形态。
      </p>
    </div>

    <div v-else class="cc-empty">所选台风均无可对比的路径数据</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { compareColor } from '../constants/typhoon'

const props = defineProps({
  typhoons: { type: Array, default: () => [] }
})

const W = 640
const H = 200
const PLOT = { top: 20, bottom: 168, left: 46, right: 624 }

const series = computed(() =>
  (Array.isArray(props.typhoons) ? props.typhoons : [])
    .map((t, i) => ({
      name: (t && t.name) || `台风 ${i + 1}`,
      color: compareColor(i),
      values: (Array.isArray(t && t.path) ? t.path : [])
        .map((p) => Number(p && p.wind))
        .filter((v) => Number.isFinite(v))
    }))
    .filter((s) => s.values.length > 0)
)

const maxLen = computed(() =>
  series.value.reduce((m, s) => Math.max(m, s.values.length), 0)
)

const flat = computed(() => series.value.flatMap((s) => s.values))
const minV = computed(() => (flat.value.length ? Math.min(...flat.value) : 0))
const maxV = computed(() => (flat.value.length ? Math.max(...flat.value) : 0))

function xOf(i) {
  const n = maxLen.value
  if (n <= 1) return (PLOT.left + PLOT.right) / 2
  return PLOT.left + (i / (n - 1)) * (PLOT.right - PLOT.left)
}

function yOf(v) {
  const span = maxV.value - minV.value || 1
  return PLOT.bottom - ((v - minV.value) / span) * (PLOT.bottom - PLOT.top)
}

const seriesWithPath = computed(() =>
  series.value.map((s) => ({
    ...s,
    d: s.values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
      .join(' ')
  }))
)

const gridLines = computed(() => {
  const rows = 4
  const out = []
  for (let k = 0; k <= rows; k++) {
    const y = PLOT.top + ((PLOT.bottom - PLOT.top) * k) / rows
    const v = maxV.value - (maxV.value - minV.value) * (k / rows)
    out.push({ y: y.toFixed(1), label: Math.round(v) })
  }
  return out
})
</script>

<style scoped>
.cmp-chart { width: 100%; }
.cc-canvas { width: 100%; }
.cc-svg { width: 100%; height: auto; display: block; overflow: visible; }

.cc-grid { stroke: rgba(255, 255, 255, 0.07); stroke-width: 1; }
.cc-axis-label { fill: var(--text-muted); font-size: 10px; text-anchor: end; }

.cc-line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.cc-legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}
.cc-legend span { display: inline-flex; align-items: center; gap: 6px; }
.cc-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

.cc-note {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

.cc-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
