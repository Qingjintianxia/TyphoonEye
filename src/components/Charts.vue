<template>
  <div class="chart-container glass-card" ref="containerRef">
    <div class="chart-header">
      <span class="section-title">{{ title }}</span>
    </div>
    <div ref="chartRef" :style="{ height: height + 'px' }"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
// 按需引入而非 `import * as echarts`：全量包会让本 chunk 膨胀到 1MB+。
// 本项目只用柱/线/饼三类图 + tooltip/legend/grid 三个组件，按需注册即可。
// 新增图表类型时需在此注册，未注册的 series 不会渲染
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer
])

const props = defineProps({
  title: String,
  option: Object,
  height: { type: Number, default: 300 }
})

const chartRef = ref(null)
const containerRef = ref(null)
let chart = null

function initChart() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  chart.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#8899aa' },
    ...props.option
  })
}

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})

watch(() => props.option, (val) => {
  if (chart && val) chart.setOption(val, true)
}, { deep: true })
</script>

<style scoped>
.chart-container {
  padding: 20px;
}

.chart-header {
  margin-bottom: 12px;
}
</style>
