<template>
  <div class="filter-bar glass-card">
    <div class="fb-row">
      <div class="fb-search">
        <svg class="fb-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.5" y2="16.5" />
        </svg>
        <input
          v-model="kwInput"
          type="search"
          class="fb-input"
          placeholder="搜索台风名称 / 英文名 / 编号"
          aria-label="搜索台风"
        />
      </div>

      <div class="fb-sort">
        <label class="fb-label" for="fb-sort-select">排序</label>
        <select
          id="fb-sort-select"
          class="fb-select"
          :value="query.sortBy"
          @change="onSortChange"
        >
          <option v-for="o in sortOptions" :key="o.key" :value="o.key">{{ o.label }}</option>
        </select>
        <button
          type="button"
          class="fb-order"
          :title="query.sortOrder === 'asc' ? '当前升序，点击切换为降序' : '当前降序，点击切换为升序'"
          :aria-label="query.sortOrder === 'asc' ? '切换为降序' : '切换为升序'"
          @click="toggleOrder"
        >
          {{ query.sortOrder === 'asc' ? '↑ 升' : '↓ 降' }}
        </button>
      </div>
    </div>

    <div class="fb-row fb-groups">
      <div class="fb-group">
        <span class="fb-label">状态</span>
        <div class="fb-chips">
          <button
            v-for="s in STATUS_OPTIONS"
            :key="s.key"
            type="button"
            class="chip"
            :aria-pressed="query.status === s.key"
            @click="patch({ status: s.key })"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <div class="fb-group">
        <span class="fb-label">强度</span>
        <div class="fb-chips">
          <button
            v-for="lv in TYPHOON_LEVELS"
            :key="lv.key"
            type="button"
            class="chip"
            :aria-pressed="query.levels.includes(lv.key)"
            :style="chipStyle(lv.color, query.levels.includes(lv.key))"
            @click="toggleLevel(lv.key)"
          >
            {{ lv.key }}
          </button>
        </div>
      </div>

      <div class="fb-group">
        <span class="fb-label">预警</span>
        <div class="fb-chips">
          <button
            v-for="w in WARNING_LEVELS"
            :key="w.key"
            type="button"
            class="chip"
            :aria-pressed="query.warnings.includes(w.key)"
            :style="chipStyle(w.color, query.warnings.includes(w.key))"
            @click="toggleWarning(w.key)"
          >
            {{ w.short }}
          </button>
        </div>
      </div>
    </div>

    <div class="fb-row fb-footer">
      <span class="fb-count">
        <template v-if="filtered">筛选出 {{ count }} / {{ total }} 条</template>
        <template v-else>共 {{ total }} 条</template>
      </span>
      <button v-if="filtered" type="button" class="fb-clear" @click="clearFilters">
        清除筛选
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import {
  TYPHOON_LEVELS,
  WARNING_LEVELS,
  SORT_OPTIONS,
  defaultSortOrder
} from '../constants/typhoon'
import { createDefaultQuery } from '../composables/useTyphoonFilter'

const props = defineProps({
  query: { type: Object, required: true },
  total: { type: Number, default: 0 },
  count: { type: Number, default: 0 },
  filtered: { type: Boolean, default: false }
})

const emit = defineEmits(['update:query', 'toggle-level', 'toggle-warning'])

const sortOptions = SORT_OPTIONS
const STATUS_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '活跃中' },
  { key: 'historical', label: '已结束' }
]

/** 把 6 位 hex 转 rgba，用于 chip 选中态底色 */
function rgba(hex, alpha) {
  const h = String(hex || '').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return 'transparent'
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function chipStyle(color, active) {
  if (!active) return {}
  return { background: rgba(color, 0.18), borderColor: color, color }
}

function patch(partial) {
  emit('update:query', { ...props.query, ...partial })
}

function toggleLevel(level) {
  emit('toggle-level', level)
}

function toggleWarning(level) {
  emit('toggle-warning', level)
}

function onSortChange(e) {
  const key = e.target.value
  patch({ sortBy: key, sortOrder: defaultSortOrder(key) })
}

function toggleOrder() {
  patch({ sortOrder: props.query.sortOrder === 'asc' ? 'desc' : 'asc' })
}

function clearFilters() {
  emit('update:query', {
    ...createDefaultQuery(),
    sortBy: props.query.sortBy,
    sortOrder: props.query.sortOrder
  })
}

// 搜索防抖 200ms
const kwInput = ref(props.query.keyword || '')
let timer = null

watch(kwInput, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => patch({ keyword: v }), 200)
})

// 外部清除筛选时，把输入框同步回空
watch(
  () => props.query.keyword,
  (v) => {
    if (v !== kwInput.value) kwInput.value = v || ''
  }
)

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.filter-bar {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fb-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.fb-groups {
  gap: 18px;
  align-items: flex-start;
}

.fb-search {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.fb-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.fb-input {
  width: 100%;
  padding: 8px 12px 8px 32px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition);
}
.fb-input:focus { border-color: var(--blue); }
.fb-input::placeholder { color: var(--text-muted); }

.fb-sort {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fb-label {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.fb-select {
  padding: 7px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}
.fb-select:focus { border-color: var(--blue); }

.fb-order {
  padding: 7px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
}
.fb-order:hover { border-color: var(--blue); color: var(--text-primary); }

.fb-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.fb-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
  outline: none;
}
.chip:hover { border-color: var(--blue); color: var(--text-primary); }
.chip:focus-visible { box-shadow: 0 0 0 2px var(--blue-glow); }
.chip[aria-pressed='true'] { font-weight: 600; }

.fb-footer {
  justify-content: space-between;
  padding-top: 2px;
}

.fb-count {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.fb-clear {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
}
.fb-clear:hover { border-color: var(--red); color: #f87171; }
</style>
