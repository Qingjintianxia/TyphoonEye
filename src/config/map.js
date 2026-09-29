/**
 * 国内合规底图配置（天地图 Tianditu）
 *
 * 采用国家地理信息公共服务平台「天地图」作为合规底图来源。
 * 天地图具备国内测绘资质，国界线、台湾及南海诸岛画法符合国家标准，
 * 取代原境外 cartocdn 底图（其画法在国内不合规）。
 *
 * 设计约定：
 * 1. 本文件是底图创建的唯一入口。所有地图组件一律调用 createBaseTileLayers()，
 * 不得自行 L.tileLayer() 拼底图 URL —— 历史上三个组件各写一份，改一次要动三处。
 * 2. 密钥从 .env 的 VITE_TIANDITU_KEY 读取（见 .env.example）。未配置时 HAS_COMPLIANT_MAP
 * 为 false，底图创建函数返回空数组，组件降级为内置「示意海图」占位，
 * 绝不回退到任何境外底图服务。
 * 3. 修改 .env 后必须重启 dev server：import.meta.env 在启动/构建期注入，不会热更新。
 */

const TIANDITU_KEY = (import.meta.env?.VITE_TIANDITU_KEY || '').trim()

export const HAS_COMPLIANT_MAP = TIANDITU_KEY.length > 0

// 天地图 DataServer XYZ 接口
// 参数顺序 x(列)/y(行)/l(层级) 与 Leaflet 的 {x}/{y}/{z} 占位符一一对应
function tileUrl(type) {
  return `https://t{s}.tianditu.gov.cn/DataServer?T=${type}&x={x}&y={y}&l={z}&tk=${TIANDITU_KEY}`
}

// 天地图子域 t0~t7
export const TIANDITU_SUBDOMAINS = '01234567'

// 天地图矢量/影像/地形均支持 1~18 级。
// 原 maxZoom=12 把用户锁在省级视野，看不到城市级落区；已实测 14 级有真实瓦片。
// （注：18 级在部分海域/境外区域会返回空白瓦片，属正常覆盖边界，非配置错误。）
export const TIANDITU_MIN_ZOOM = 3
export const TIANDITU_MAX_ZOOM = 18

export const MAP_ATTRIBUTION = HAS_COMPLIANT_MAP ? '© 天地图 GS(2023)3213号' : ''

/**
 * 可选底图类型。
 * base = 底图图层，label = 对应注记图层（天地图的注记是独立图层，必须叠加才有地名）。
 */
export const BASE_LAYER_TYPES = [
  { key: 'vector', label: '矢量', baseType: 'vec_w', labelType: 'cva_w' },
  { key: 'image', label: '影像', baseType: 'img_w', labelType: 'cia_w' },
  { key: 'terrain', label: '地形', baseType: 'ter_w', labelType: 'cta_w' }
]

const TYPE_MAP = BASE_LAYER_TYPES.reduce((acc, t) => {
  acc[t.key] = t
  return acc
}, {})

function resolveType(typeKey) {
  return TYPE_MAP[typeKey] || BASE_LAYER_TYPES[0]
}

/**
 * 创建底图图层（底图 + 注记）。唯一的底图创建入口。
 *
 * @param {object} L Leaflet 实例由调用方传入，避免本模块硬依赖 leaflet
 * @param {object} map L.map 实例
 * @param {string} typeKey vector | image | terrain
 * @returns {Array} 已加入地图的图层数组（供切换时移除）；无密钥时返回空数组
 */
export function createBaseTileLayers(L, map, typeKey = 'vector') {
  if (!HAS_COMPLIANT_MAP || !map || !L) return []

  const type = resolveType(typeKey)
  const common = {
    minZoom: TIANDITU_MIN_ZOOM,
    maxZoom: TIANDITU_MAX_ZOOM,
    subdomains: TIANDITU_SUBDOMAINS,
    attribution: MAP_ATTRIBUTION
  }

  const base = L.tileLayer(tileUrl(type.baseType), common).addTo(map)
  const label = L.tileLayer(tileUrl(type.labelType), common).addTo(map)
  return [base, label]
}

/**
 * 切换底图类型：先移除旧层再建新层，避免叠加残影。
 *
 * @returns {Array} 新的底图图层数组
 */
export function switchBaseLayer(L, map, currentLayers, typeKey) {
  if (Array.isArray(currentLayers)) {
    currentLayers.forEach((layer) => map.removeLayer(layer))
  }
  return createBaseTileLayers(L, map, typeKey)
}

/**
 * 合法化底图类型 key，非法输入回退到矢量。
 * 用于 URL / 本地存储等外部输入，避免拼出不存在的图层类型。
 */
export function normalizeBaseLayerType(typeKey) {
  return TYPE_MAP[typeKey] ? typeKey : BASE_LAYER_TYPES[0].key
}
