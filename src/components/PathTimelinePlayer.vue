<template>
  <div class="player glass-card">
    <div class="pl-controls">
      <button
        type="button"
        class="pl-play"
        :disabled="!canPlay"
        :aria-label="playing ? '暂停回放' : '播放回放'"
        :title="playing ? '暂停' : '播放'"
        @click="emit('toggle')"
      >
        <svg v-if="!playing" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6 4 20 12 6 20" />
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      </button>

      <button
        type="button"
        class="pl-reset"
        :disabled="!canPlay"
        aria-label="回到起点"
        title="回到起点"
        @click="emit('reset')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="11 5 4 12 11 19" />
          <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      </button>

      <div class="pl-slider">
        <input
          type="range"
          min="0"
          :max="Math.max(0, total - 1)"
          :value="index"
          :disabled="!canPlay"
          class="pl-range"
          :aria-label="`路径回放进度，当前第 ${index + 1} 个路径点，共 ${total} 个`"
          @input="onSeek"
        />
        <span class="pl-count">{{ index + 1 }} / {{ total }}</span>
      </div>

      <div class="pl-speeds">
        <button
          v-for="s in speedOptions"
          :key="s"
          type="button"
          class="pl-speed"
          :class="{ active: speed === s }"
          :aria-pressed="speed === s"
          @click="emit('speed-change', s)"
        >
          {{ s }}x
        </button>
      </div>
    </div>

    <div class="pl-meta" v-if="current">
      <div class="pl-meta-item">
        <span class="pl-meta-label">时刻</span>
        <span class="pl-meta-value">{{ formatDateTime(current.time) }}</span>
      </div>
      <div class="pl-meta-item">
        <span class="pl-meta-label">风速</span>
        <span class="pl-meta-value">{{ formatWind(current.wind) }}</span>
      </div>
      <div class="pl-meta-item">
        <span class="pl-meta-label">等级</span>
        <span class="badge" :class="levelBadgeClass(current.level)">{{ current.level || '—' }}</span>
      </div>
      <div class="pl-meta-item">
        <span class="pl-meta-label">位置</span>
        <span class="pl-meta-value pl-coord">{{ formatCoord(current.lat, current.lng) }}</span>
      </div>
      <span v-if="isFuture" class="pl-forecast">预报段</span>
      <span v-else class="pl-realtime">实况段</span>
    </div>

    <p v-if="!canPlay" class="pl-hint">路径点不足，无法回放</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { levelBadgeClass } from '../constants/typhoon'
import { formatDateTime, formatWind, formatCoord } from '../utils/format'
import { SPEED_OPTIONS } from '../composables/usePathPlayer'

const props = defineProps({
  points: { type: Array, default: () => [] },
  index: { type: Number, default: 0 },
  playing: { type: Boolean, default: false },
  speed: { type: Number, default: 1 },
  canPlay: { type: Boolean, default: false },
  /** 实况末点下标，用于标注当前处于实况段还是预报段 */
  realtimeIndex: { type: Number, default: -1 }
})

const emit = defineEmits(['toggle', 'seek', 'speed-change', 'reset'])

const speedOptions = SPEED_OPTIONS
const total = computed(() => props.points.length)
const current = computed(() => props.points[props.index] || null)
const isFuture = computed(
  () => props.realtimeIndex >= 0 && props.index > props.realtimeIndex
)

function onSeek(e) {
  emit('seek', Number(e.target.value))
}
</script>

<style scoped>
.player {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pl-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.pl-play,
.pl-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition);
}
.pl-play {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
.pl-play:hover:not(:disabled) { filter: brightness(1.12); }
.pl-reset:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); }
.pl-play:disabled,
.pl-reset:disabled { opacity: 0.45; cursor: not-allowed; }

.pl-slider {
  flex: 1;
  min-width: 180px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.pl-range {
  flex: 1;
  accent-color: var(--blue);
  cursor: pointer;
}
.pl-range:disabled { cursor: not-allowed; opacity: 0.5; }

.pl-count {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pl-speeds { display: flex; gap: 4px; }
.pl-speed {
  padding: 4px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
}
.pl-speed:hover { border-color: var(--blue); }
.pl-speed.active {
  background: rgba(59, 130, 246, 0.18);
  border-color: var(--blue);
  color: var(--blue);
  font-weight: 600;
}

.pl-meta {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.pl-meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pl-meta-label { font-size: 11px; color: var(--text-muted); }
.pl-meta-value { font-size: 13px; font-weight: 600; }
.pl-coord { font-family: 'Courier New', monospace; font-weight: 500; font-size: 12px; }

.pl-realtime,
.pl-forecast {
  margin-left: auto;
  padding: 2px 9px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.pl-realtime { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.pl-forecast { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }

.pl-hint { margin: 0; font-size: 12px; color: var(--text-muted); }
</style>
