<template>
  <div class="stat-card glass-card" :class="[`stat-${variant}`, { 'fade-in': animated }]">
    <div class="stat-icon">
      <slot name="icon" />
    </div>
    <div class="stat-info">
      <div class="stat-value">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
    <div class="stat-trend" v-if="trend">
      <span :class="trend > 0 ? 'trend-up' : 'trend-down'">
        {{ trend > 0 ? '↑' : '↓' }} {{ Math.abs(trend) }}%
      </span>
      <span class="trend-label">较昨日</span>
    </div>
    <div class="stat-glow"></div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [String, Number],
  variant: { type: String, default: 'blue' },
  trend: Number,
  animated: { type: Boolean, default: true }
})
</script>

<style scoped>
.stat-card {
  padding: 24px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.stat-glow {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  opacity: 0.08;
  pointer-events: none;
  transition: opacity var(--transition);
}

.stat-card:hover .stat-glow { opacity: 0.15; }
.stat-blue .stat-glow { background: var(--blue); }
.stat-green .stat-glow { background: var(--green); }
.stat-orange .stat-glow { background: var(--orange); }
.stat-red .stat-glow { background: var(--red); }

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-blue .stat-icon { background: rgba(59,130,246,0.12); color: var(--blue); }
.stat-green .stat-icon { background: rgba(16,185,129,0.12); color: var(--green); }
.stat-orange .stat-icon { background: rgba(249,115,22,0.12); color: var(--orange); }
.stat-red .stat-icon { background: rgba(239,68,68,0.12); color: var(--red); }

.stat-value {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1;
  margin-bottom: 6px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-trend {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.trend-up { color: var(--green); font-size: 13px; font-weight: 600; }
.trend-down { color: var(--red); font-size: 13px; font-weight: 600; }
.trend-label { font-size: 11px; color: var(--text-muted); }
</style>
