<template>
  <div class="detail-map glass-card">
    <div class="dm-header">
      <span class="section-title">{{ title }}</span>
      <div class="dm-legend">
        <span><i class="dm-ring" style="background:#3b82f6"></i>7级风圈</span>
        <span><i class="dm-ring" style="background:#f59e0b"></i>10级风圈</span>
        <span><i class="dm-ring" style="background:#ef4444"></i>12级风圈</span>
        <template v-if="currentIndex >= 0">
          <span><i class="dm-line"></i>实况</span>
          <span><i class="dm-line is-dashed"></i>预报</span>
        </template>
      </div>
    </div>
    <div ref="el" class="dm-container" :class="{ 'sea-chart': !hasMap }"></div>
    <div class="dm-attribution" v-if="hasMap">{{ attribution }}</div>
    <div class="dm-hint" v-else>未配置天地图密钥，当前为示意海图</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
// 底图创建统一走 config/map.js，本组件不再自行拼装 tileLayer
import { HAS_COMPLIANT_MAP, MAP_ATTRIBUTION, createBaseTileLayers } from '../config/map'
import { warningColor, levelColor } from '../constants/typhoon'

const props = defineProps({
  typhoon: { type: Object, default: null },
  title: { type: String, default: '台风路径与风圈' },
  /** 回放下标：>=0 时按该时刻拆分实况段 / 预报段；-1 表示不回放，画完整路径 */
  currentIndex: { type: Number, default: -1 },
  /** 定位目标城市 { name, lat, lng }；null 表示取消定位 */
  focusCity: { type: Object, default: null },
  /** 定位序号：同一城市再次点击时强制重新定位（对象内容不变也能触发 watch） */
  focusSeq: { type: Number, default: 0 }
})

const el = ref(null)
const hasMap = HAS_COMPLIANT_MAP
const attribution = MAP_ATTRIBUTION
let map = null
let layers = []
// 聚焦标记独立成层：不能混入 layers，否则会被 clearLayers() 一并清掉
let focusLayer = []
let focusActive = false
let lastCenter = [22, 125]

function clearLayers() {
  layers.forEach((l) => map && map.removeLayer(l))
  layers = []
}

function render() {
  if (!map) return
  clearLayers()
  const t = props.typhoon
  if (!t) return

  const path = t.path || []
  const center =
    t.latitude != null && t.longitude != null
      ? [t.latitude, t.longitude]
      : path.length
        ? [path[path.length - 1].lat, path[path.length - 1].lng]
        : [22, 125]

  const color = warningColor(t.warningLevel) || '#3b82f6'

  // 回放下标有效时，把路径拆成实况段（实线）与预报段（虚线 + 降透明度）
  const coords = path.map((p) => [p.lat, p.lng])
  const idx = props.currentIndex
  const replaying = Number.isInteger(idx) && idx >= 0 && idx < path.length

  if (replaying) {
    const past = coords.slice(0, idx + 1)
    const future = coords.slice(idx)
    if (past.length >= 2) {
      layers.push(L.polyline(past, { color, weight: 3.5, opacity: 0.95 }).addTo(map))
    }
    if (future.length >= 2) {
      layers.push(
        L.polyline(future, { color, weight: 2.5, opacity: 0.45, dashArray: '6 6' }).addTo(map)
      )
    }
  } else if (coords.length >= 2) {
    layers.push(L.polyline(coords, { color, weight: 3, opacity: 0.7 }).addTo(map))
  }

  // 路径点：回放时当前点放大，并按该时刻强度等级着色
  path.forEach((p, i) => {
    const isCurrent = replaying && i === idx
    const isLast = !replaying && i === path.length - 1
    layers.push(
      L.circleMarker([p.lat, p.lng], {
        radius: isCurrent ? 9 : isLast ? 6 : 3,
        color: isCurrent ? '#fff' : color,
        fillColor: isCurrent ? levelColor(p.level) : isLast ? '#fff' : color,
        fillOpacity: 1,
        weight: isCurrent ? 3 : 2
      }).addTo(map)
    )
  })

  // 非回放态才画台风当前位置标记，避免与回放当前点重叠
  if (!replaying && t.latitude != null && t.longitude != null) {
    layers.push(
      L.circleMarker([t.latitude, t.longitude], {
        radius: 8,
        color: '#fff',
        fillColor: color,
        fillOpacity: 1,
        weight: 3
      }).addTo(map)
    )
  }

  // 风圈：真实地理比例（km → 米），回放时随当前点移动。
  // 局限说明：mock 的 path 无逐点风圈数据，故半径仍取台风级 radius7/10/12。
  const rp = replaying ? path[idx] : null
  const ringCenter =
    rp && rp.lat != null && rp.lng != null ? [rp.lat, rp.lng] : center

  const rings = [
    { r: t.radius7, color: '#3b82f6' },
    { r: t.radius10, color: '#f59e0b' },
    { r: t.radius12, color: '#ef4444' }
  ].filter((x) => x.r && x.r > 0)

  rings.forEach((x) => {
    layers.push(
      L.circle(ringCenter, {
        radius: x.r * 1000,
        color: x.color,
        weight: 2,
        fillColor: x.color,
        fillOpacity: 0.08,
        dashArray: '4 4'
      }).addTo(map)
    )
  })

  lastCenter = ringCenter
  // 聚焦城市期间不要把视图拽回台风中心：回放播放、切换台风都会触发本函数
  if (!focusActive) map.setView(ringCenter, 5)
}

/** 城市定位：flyTo + 城市标记；传 null 则取消定位并回到台风视角 */
function applyFocus() {
  if (!map) return
  focusLayer.forEach((l) => map.removeLayer(l))
  focusLayer = []
  focusActive = false

  const c = props.focusCity
  if (!c || !Number.isFinite(Number(c.lat)) || !Number.isFinite(Number(c.lng))) {
    map.setView(lastCenter, map.getZoom() || 5)
    return
  }

  focusActive = true
  const marker = L.marker([Number(c.lat), Number(c.lng)], {
    icon: L.divIcon({
      className: 'city-focus-marker',
      html: `<span class="cfm-label">${c.name}</span><i class="cfm-dot"></i>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    }),
    // 压过风圈与路径点，保证标记始终可见
    zIndexOffset: 1000
  }).addTo(map)
  marker.bindTooltip(`${c.name}`, { direction: 'top', className: 'city-focus-tip' })
  focusLayer.push(marker)

  map.flyTo([Number(c.lat), Number(c.lng)], 8, { duration: 0.8 })
}

function initMap() {
  map = L.map(el.value, {
    center: [22, 125],
    zoom: 5,
    zoomControl: true,
    // 版权信息由 .dm-attribution 以项目风格渲染，关闭原生控件避免重复显示
    attributionControl: false
  })

  createBaseTileLayers(L, map)
  // 右下角：左下角已被 .dm-attribution 占用
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map)

  render()
  // 同 TyphoonMap：本组件可能迟到挂载，focusCity 已赋值时补一次定位
  applyFocus()
}

onMounted(initMap)
onUnmounted(() => {
  map && map.remove()
  map = null
})
watch([() => props.typhoon, () => props.currentIndex], render, { deep: true })
watch([() => props.focusCity, () => props.focusSeq], applyFocus)
</script>

<style scoped>
.detail-map {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  gap: 8px;
}
.dm-legend {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--text-secondary);
}
.dm-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dm-ring {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.dm-line {
  width: 18px;
  height: 0;
  border-top: 3px solid var(--text-secondary);
  display: inline-block;
}
.dm-line.is-dashed {
  border-top-style: dashed;
  opacity: 0.5;
}
.dm-container {
  width: 100%;
  height: 420px;
  min-height: 320px;
}
.dm-attribution {
  padding: 4px 10px;
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}
.dm-hint {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}
</style>
