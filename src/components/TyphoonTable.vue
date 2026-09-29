<template>
  <div class="glass-card" style="padding: 20px;">
    <div class="section-header">
      <span class="section-title">{{ title }}</span>
      <router-link to="/monitor" class="btn" v-if="showMore">查看全部 →</router-link>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :class="{ 'is-sortable': col.sortable }">
              <button
                v-if="col.sortable"
                type="button"
                class="th-sort"
                :class="{ active: sortBy === col.key }"
                :aria-label="`按${col.label}排序`"
                @click="emit('sort', col.key)"
              >
                {{ col.label }}
                <span class="th-arrow">
                  {{ sortBy === col.key ? (sortOrder === 'asc' ? '↑' : '↓') : '↕' }}
                </span>
              </button>
              <span v-else>{{ col.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(t, i) in typhoons"
            :key="t.id"
            class="table-row"
            :class="`fade-in fade-in-${Math.min(i + 1, 4)}`"
            tabindex="0"
            role="link"
            :aria-label="`查看 ${t.name} 详情`"
            @click="openDetail(t.id)"
            @keydown.enter.prevent="openDetail(t.id)"
            @keydown.space.prevent="openDetail(t.id)"
          >
            <td>
              <div class="typhoon-name">
                <span class="name-cn">{{ t.name }}</span>
                <span class="name-en">{{ t.nameEn }}</span>
              </div>
            </td>
            <td><span class="badge" :class="levelBadgeClass(t.level)">{{ t.level }}</span></td>
            <td><span class="wind-value">{{ formatNumber(t.windSpeed) }}</span> <span class="unit">m/s</span></td>
            <td>{{ formatNumber(t.pressure, { unit: 'hPa' }) }}</td>
            <td>
              <span class="warn-tag is-lg" :class="`warn-${t.warningLevel}`">
                {{ warningLabel(t.warningLevel) }}
              </span>
            </td>
            <td>
              <div class="city-tags" v-if="safeList(t.affectedCities).length">
                <span class="city-tag" v-for="city in safeList(t.affectedCities).slice(0, 2)" :key="city">{{ city }}</span>
                <span v-if="safeList(t.affectedCities).length > 2" class="city-more">
                  +{{ safeList(t.affectedCities).length - 2 }}
                </span>
              </div>
              <span v-else class="text-muted">暂无</span>
            </td>
            <td class="text-muted">{{ formatDateTime(t.updateTime) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!typhoons.length" class="empty-state">
      <p class="es-text">{{ emptyText }}</p>
      <slot name="empty" />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { levelBadgeClass, warningLabel } from '../constants/typhoon'
import { formatNumber, formatDateTime, safeList } from '../utils/format'

defineProps({
  title: { type: String, default: '台风列表' },
  typhoons: { type: Array, default: () => [] },
  showMore: { type: Boolean, default: true },
  /** 当前排序字段（受控），由外部筛选逻辑持有 */
  sortBy: { type: String, default: '' },
  /** 当前排序方向（受控） */
  sortOrder: { type: String, default: 'desc' },
  emptyText: { type: String, default: '暂无台风数据' }
})

const emit = defineEmits(['sort'])

/** 列定义：sortable 列点击表头抛 sort 事件，状态完全由外部驱动 */
const columns = [
  { key: 'name', label: '台风名称' },
  { key: 'level', label: '强度等级', sortable: true },
  { key: 'windSpeed', label: '最大风速', sortable: true },
  { key: 'pressure', label: '中心气压', sortable: true },
  { key: 'warningLevel', label: '预警等级' },
  { key: 'affectedCities', label: '影响区域' },
  { key: 'updateTime', label: '更新时间', sortable: true }
]

const router = useRouter()

function openDetail(id) {
  if (!id) return
  router.push(`/typhoon/${id}`)
}
</script>

<style scoped>
.table-scroll {
  overflow-x: auto;
  margin: 0 -4px;
  padding: 0 4px;
}

.typhoon-name { display: flex; flex-direction: column; }
.name-cn { font-weight: 600; font-size: 14px; }
.name-en { font-size: 11px; color: var(--text-muted); }
.wind-value { font-weight: 600; font-size: 16px; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.unit { font-size: 12px; color: var(--text-muted); }

.city-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.city-tag { font-size: 12px; padding: 1px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; }
.city-more { font-size: 11px; color: var(--text-muted); }

.text-muted { color: var(--text-muted); }
.empty-state { text-align: center; padding: 40px; color: var(--text-muted); }

.table-row { transition: background var(--transition); cursor: pointer; outline: none; }
.table-row:hover { background: rgba(255,255,255,0.03); }
.table-row:focus-visible { background: rgba(59,130,246,0.08); box-shadow: inset 2px 0 0 var(--blue); }

.data-table { min-width: 720px; }

.is-sortable { padding: 0; }
.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 8px 4px;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  border-radius: 4px;
  transition: color var(--transition);
}
.th-sort:hover { color: var(--text-primary); }
.th-sort:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.th-sort.active { color: var(--blue); font-weight: 600; }
.th-arrow { font-size: 11px; opacity: 0.75; }

.es-text { margin: 0 0 12px; }
</style>
