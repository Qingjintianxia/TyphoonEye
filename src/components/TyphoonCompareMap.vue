<template>
  <div class="cmp-map glass-card">
    <div class="cm-header">
      <span class="section-title">路径叠加对比</span>
      <div class="cm-legend" v-if="typhoons.length">
        <span v-for="(t, i) in typhoons" :key="t.id">
          <i class="cm-line" :style="{ background: compareColor(i) }"></i>{{ t.name }}
        </span>
      </div>
    </div>
    <div ref="el" class="cm-container" :class="{ 'sea-chart': !hasMap }"></div>
    <div class="cm-attribution" v-if="hasMap">{{ attribution }}</div>
    <div class="cm-hint" v-else>未配置天地图密钥，当前为示意海图</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
// 底图由 config/map.js 创建
import { HAS_COMPLIANT_MAP, MAP_ATTRIBUTION, createBaseTileLayers } from '../config/map'
import { compareColor } from '../constants/typhoon'

const props = defineProps({
  typhoons: { type: Array, default: () => [] }
})

const el = ref(null)
const hasMap = HAS_COMPLIANT_MAP
const attribution = MAP_ATTRIBUTION
let map = null
let layers = []

function clearLayers() {
  layers.forEach((l) => map && map.removeLayer(l))
  layers = []
}

function render() {
  if (!map) return
  clearLayers()

  const list = Array.isArray(props.typhoons) ? props.typhoons : []
  if (!list.length) return

  const bounds = []

  list.forEach((t, i) => {
    const color = compareColor(i)
    const path = Array.isArray(t && t.path) ? t.path : []
    const coords = path
      .filter((p) => p && p.lat != null && p.lng != null)
      .map((p) => [Number(p.lat), Number(p.lng)])

    if (coords.length >= 2) {
      layers.push(L.polyline(coords, { color, weight: 3, opacity: 0.85 }).addTo(map))
    }

    coords.forEach(([la, ln], k) => {
      const isLast = k === coords.length - 1
      bounds.push([la, ln])
      layers.push(
        L.circleMarker([la, ln], {
          radius: isLast ? 7 : 3,
          color: isLast ? '#fff' : color,
          fillColor: color,
          fillOpacity: 1,
          weight: isLast ? 3 : 2
        }).addTo(map)
      )
    })
  })

  // 自动把所有路径纳入视野
  if (bounds.length) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30] })
  }
}

function initMap() {
  map = L.map(el.value, {
    center: [22, 125],
    zoom: 5,
    zoomControl: true,
    // 版权信息由 .cm-attribution 渲染，关闭原生控件
    attributionControl: false
  })

  createBaseTileLayers(L, map)
  // 右下角：左下角已被 .cm-attribution 占用
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map)

  render()
}

onMounted(initMap)
onUnmounted(() => {
  map && map.remove()
  map = null
})
watch(() => props.typhoons, render, { deep: true })
</script>

<style scoped>
.cmp-map {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.cm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  gap: 8px;
}
.cm-legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-secondary);
}
.cm-legend span { display: inline-flex; align-items: center; gap: 6px; }
.cm-line { width: 16px; height: 3px; border-radius: 2px; display: inline-block; }

.cm-container {
  width: 100%;
  height: 440px;
  min-height: 320px;
}
.cm-attribution {
  padding: 4px 10px;
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}
.cm-hint {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}
</style>
