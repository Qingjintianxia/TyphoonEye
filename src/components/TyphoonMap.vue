<template>
  <div class="map-wrapper glass-card">
    <div class="map-legend">
      <!-- 底图切换：仅在配置了合规底图时可用，无 key 时无底图可切 -->
      <div class="base-switch" v-if="hasMap">
        <button
          v-for="t in baseLayerTypes"
          :key="t.key"
          type="button"
          class="bs-btn"
          :class="{ 'is-on': baseLayer === t.key }"
          :aria-pressed="baseLayer === t.key"
          @click="setBaseLayer(t.key)"
        >{{ t.label }}</button>
      </div>
      <div class="legend-item"><span class="legend-dot" style="background:#3b82f6"></span>蓝色预警</div>
      <div class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span>黄色预警</div>
      <div class="legend-item"><span class="legend-dot" style="background:#f97316"></span>橙色预警</div>
      <div class="legend-item"><span class="legend-dot" style="background:#ef4444"></span>红色预警</div>
    </div>
    <div class="map-attribution" v-if="hasMap">{{ attribution }}</div>
    <div class="map-hint" v-else>未配置天地图密钥，当前为示意海图</div>
    <div ref="mapContainer" class="map-container" :class="{ 'sea-chart': !hasMap }"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
// 底图创建与切换由 config/map.js 提供
import {
  HAS_COMPLIANT_MAP,
  MAP_ATTRIBUTION,
  BASE_LAYER_TYPES,
  createBaseTileLayers,
  switchBaseLayer
} from '../config/map'
import { warningColor, warningLabel } from '../constants/typhoon'

const props = defineProps({
  typhoons: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  /** 定位目标城市 { name, lat, lng }；null 表示取消定位 */
  focusCity: { type: Object, default: null },
  /** 定位序号：同一城市再次点击时强制重新定位 */
  focusSeq: { type: Number, default: 0 }
})

const emit = defineEmits(['select'])
const mapContainer = ref(null)
const hasMap = HAS_COMPLIANT_MAP
const attribution = MAP_ATTRIBUTION
const baseLayerTypes = BASE_LAYER_TYPES
const baseLayer = ref(BASE_LAYER_TYPES[0].key)
let map = null
let pathLayers = []
let baseLayers = []
// 聚焦标记独立成层：不能混入 pathLayers，否则重绘路径时会被一起清掉
let focusLayer = []
let lastCenter = [22, 125]
let lastZoom = 5

function setBaseLayer(key) {
  if (!map || baseLayer.value === key) return
  baseLayer.value = key
  baseLayers = switchBaseLayer(L, map, baseLayers, key)
}

function createTyphoonIcon(color) {
  return L.divIcon({
    className: 'typhoon-marker',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 0 12px ${color}, 0 0 24px ${color};
      animation: pulse 2s infinite;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  })
}

/** 城市定位：flyTo + 城市标记；传 null 则取消定位并回到原视角 */
function applyFocus() {
  if (!map) return
  focusLayer.forEach((l) => map.removeLayer(l))
  focusLayer = []

  const c = props.focusCity
  if (!c || !Number.isFinite(Number(c.lat)) || !Number.isFinite(Number(c.lng))) {
    map.setView(lastCenter, lastZoom)
    return
  }

  const marker = L.marker([Number(c.lat), Number(c.lng)], {
    icon: L.divIcon({
      className: 'city-focus-marker',
      html: `<span class="cfm-label">${c.name}</span><i class="cfm-dot"></i>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    }),
    zIndexOffset: 1000
  }).addTo(map)
  marker.bindTooltip(`${c.name}`, { direction: 'top', className: 'city-focus-tip' })
  focusLayer.push(marker)

  map.flyTo([Number(c.lat), Number(c.lng)], 8, { duration: 0.8 })
}

function initMap() {
  map = L.map(mapContainer.value, {
    center: [22, 125],
    zoom: 5,
    zoomControl: false,
    // 版权信息由下方 .map-attribution 渲染，关闭原生控件
    attributionControl: false
  })

  // 国内合规底图：天地图底图 + 中文注记层（无 key 时返回空数组，仅留海图占位，不加载任何境外底图）
  baseLayers = createBaseTileLayers(L, map, baseLayer.value)

  L.control.zoom({ position: 'bottomright' }).addTo(map)
  // 台风影响范围判断需要距离感，比例尺是刚需。
  // 放右下角：左下角已被 .map-attribution 占用，同角会叠在一起。
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map)

  // 地图可能是"迟到挂载"的（父页面在数据加载完才渲染本组件）。
// 此时 focusCity 已赋值，watch 不会再触发，这里补一次定位
  applyFocus()
}

function renderPaths() {
  pathLayers.forEach(l => map.removeLayer(l))
  pathLayers = []

  props.typhoons.forEach(t => {
    const path = t.path || t.fullPath
    if (!path || path.length < 2) return

    const color = warningColor(t.warningLevel) || '#3b82f6'
    const coords = path.map(p => [p.lat, p.lng])

    // Draw path line
    const line = L.polyline(coords, {
      color,
      weight: 3,
      opacity: 0.6,
      dashArray: t.status === 'historical' ? '8 6' : '0'
    }).addTo(map)
    pathLayers.push(line)

    // Draw path points
    path.forEach((p, i) => {
      const isLast = i === path.length - 1
      const radius = isLast ? 7 : 4
      const circle = L.circleMarker([p.lat, p.lng], {
        radius,
        color,
        fillColor: isLast ? '#fff' : color,
        fillOpacity: 1,
        weight: 2,
        opacity: isLast ? 1 : 0.6
      }).addTo(map)

      circle.bindTooltip(`
        <div style="font-family:Inter,sans-serif;font-size:12px;">
          <strong>${t.name}</strong> ${t.nameEn}<br/>
          时间: ${p.time}<br/>
          风速: ${p.wind} m/s<br/>
          等级: ${p.level}
        </div>
      `, { direction: 'top' })

      circle.on('click', () => emit('select', t.id))
      pathLayers.push(circle)
    })

    // Current position marker for active typhoons
    if (t.status === 'active' && t.latitude && t.longitude) {
      const marker = L.marker([t.latitude, t.longitude], {
        icon: createTyphoonIcon(color)
      }).addTo(map)

      marker.bindPopup(`
        <div style="font-family:Inter,sans-serif;">
          <strong style="font-size:14px;">${t.name}</strong>
          <span style="color:#8899aa;margin-left:4px;">${t.nameEn}</span><br/>
          <span style="font-size:12px;color:#8899aa;">
            等级: ${t.level}<br/>
            风速: ${t.windSpeed} m/s<br/>
            气压: ${t.pressure} hPa<br/>
            预警: ${warningLabel(t.warningLevel)}
          </span>
        </div>
      `, { className: 'typhoon-popup' })
      pathLayers.push(marker)
    }
  })
}

onMounted(() => { initMap(); renderPaths() })
onUnmounted(() => { map?.remove(); map = null })

watch(() => props.typhoons, renderPaths, { deep: true })
watch(() => props.selectedId, (id) => {
  if (!id) return
  const t = props.typhoons.find(x => x.id === id)
  if (!t) return
  lastCenter = [t.latitude || 22, t.longitude || 125]
  lastZoom = 6
  map?.setView(lastCenter, lastZoom)
})
watch([() => props.focusCity, () => props.focusSeq], applyFocus)
</script>

<style scoped>
.map-wrapper {
  padding: 0;
  overflow: hidden;
  position: relative;
  height: 100%;
  min-height: 500px;
}

.map-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
}

.map-legend {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  background: rgba(15,25,35,0.9);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  backdrop-filter: blur(12px);
}

.base-switch {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.bs-btn {
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition);
}
.bs-btn:hover { border-color: var(--blue); }
.bs-btn.is-on {
  background: rgba(59, 130, 246, 0.18);
  border-color: var(--blue);
  color: var(--blue);
  font-weight: 600;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.map-attribution {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 1000;
  font-size: 10px;
  color: var(--text-muted);
  background: rgba(15, 25, 35, 0.7);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
}

.map-hint {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 1000;
  font-size: 11px;
  color: var(--text-secondary);
  background: rgba(15, 25, 35, 0.82);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 4px;
}
</style>

<style>
.typhoon-popup .leaflet-popup-content-wrapper {
  background: rgba(15,25,35,0.95) !important;
  color: #e8edf2 !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  border-radius: 8px !important;
  backdrop-filter: blur(12px);
}

.typhoon-popup .leaflet-popup-tip {
  background: rgba(15,25,35,0.95) !important;
}

.leaflet-tooltip {
  background: rgba(15,25,35,0.95) !important;
  color: #e8edf2 !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
}
</style>
