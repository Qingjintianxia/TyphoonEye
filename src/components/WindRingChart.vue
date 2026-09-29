<template>
  <div class="wind-ring-chart">
    <svg viewBox="0 0 220 220" class="wrc-svg" role="img" aria-label="风圈半径比例图">
      <g v-for="r in rings" :key="r.key">
        <circle
          :cx="110" :cy="110" :r="r.scaled"
          :stroke="r.color" :fill="r.color"
          fill-opacity="0.06" stroke-width="2" stroke-dasharray="4 3"
        />
      </g>
      <circle cx="110" cy="110" r="4" fill="#fff" />
      <text x="110" y="114" text-anchor="middle" class="wrc-center">中心</text>
    </svg>
    <ul class="wrc-legend">
      <li v-for="r in rings" :key="r.key">
        <span class="wrc-dot" :style="{ background: r.color }"></span>
        <span class="wrc-label">{{ r.label }}</span>
        <span class="wrc-val">{{ r.value }} km</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  typhoon: { type: Object, default: null }
})

const RING_DEFS = [
  { key: 'radius7', label: '7级风圈', color: '#3b82f6' },
  { key: 'radius10', label: '10级风圈', color: '#f59e0b' },
  { key: 'radius12', label: '12级风圈', color: '#ef4444' }
]

/**
 * 计算按真实 km 比例缩放的风圈。
 * 以最大半径映射为 SVG 内半径上限（95px），其余按比例缩放，
 * 大圈在底层、小圈在上层，保证比例直观（替代原固定像素圆环）。
 */
const rings = computed(() => {
  const t = props.typhoon || {}
  const vals = RING_DEFS
    .map((d) => ({ ...d, value: Number(t[d.key]) || 0 }))
    .filter((x) => x.value > 0)
  const max = Math.max(1, ...vals.map((v) => v.value))
  const MAX_R = 95
  return vals
    .slice()
    .sort((a, b) => b.value - a.value)
    .map((v) => ({ ...v, scaled: (v.value / max) * MAX_R }))
})
</script>

<style scoped>
.wind-ring-chart {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.wrc-svg {
  width: 180px;
  height: 180px;
  flex-shrink: 0;
}
.wrc-center {
  font-size: 11px;
  fill: var(--text-muted);
}
.wrc-legend {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wrc-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
.wrc-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.wrc-label {
  min-width: 64px;
}
.wrc-val {
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
</style>
