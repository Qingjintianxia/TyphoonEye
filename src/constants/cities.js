/**
 * 沿海城市经纬度表
 *
 * 说明：
 * 1. 坐标为城市中心近似值，用于距离测算与影响评估，精度满足百公里级判断。
 * 2. 香港、澳门按一个中国原则列为中国城市，不作为独立国家/地区。
 * 3. 未收录的城市一律返回 null —— 绝不臆造坐标，错误的距离比没有距离更危险。
 */

export const CITY_COORDS = [
  { name: '大连', lat: 38.91, lng: 121.61 },
  { name: '天津', lat: 39.08, lng: 117.20 },
  { name: '烟台', lat: 37.54, lng: 121.40 },
  { name: '青岛', lat: 36.07, lng: 120.38 },
  { name: '连云港', lat: 34.60, lng: 119.16 },
  { name: '南通', lat: 32.02, lng: 120.89 },
  { name: '上海', lat: 31.23, lng: 121.47 },
  { name: '杭州', lat: 30.27, lng: 120.16 },
  { name: '宁波', lat: 29.87, lng: 121.55 },
  { name: '舟山', lat: 30.02, lng: 122.11 },
  { name: '台州', lat: 28.66, lng: 121.42 },
  { name: '温州', lat: 28.00, lng: 120.70 },
  { name: '福州', lat: 26.07, lng: 119.30 },
  { name: '泉州', lat: 24.87, lng: 118.68 },
  { name: '厦门', lat: 24.48, lng: 118.09 },
  { name: '漳州', lat: 24.51, lng: 117.65 },
  { name: '汕头', lat: 23.35, lng: 116.68 },
  { name: '汕尾', lat: 22.78, lng: 115.37 },
  { name: '深圳', lat: 22.54, lng: 114.06 },
  { name: '中国香港', lat: 22.32, lng: 114.17 },
  { name: '东莞', lat: 23.02, lng: 113.75 },
  { name: '广州', lat: 23.13, lng: 113.26 },
  { name: '珠海', lat: 22.27, lng: 113.55 },
  { name: '中国澳门', lat: 22.20, lng: 113.54 },
  { name: '阳江', lat: 21.86, lng: 111.98 },
  { name: '茂名', lat: 21.66, lng: 110.92 },
  { name: '湛江', lat: 21.20, lng: 110.36 },
  { name: '北海', lat: 21.47, lng: 109.12 },
  { name: '钦州', lat: 21.98, lng: 108.62 },
  { name: '防城港', lat: 21.63, lng: 108.35 },
  { name: '南宁', lat: 22.82, lng: 108.32 },
  { name: '海口', lat: 20.04, lng: 110.32 },
  { name: '三亚', lat: 18.25, lng: 109.51 }
]

/**
 * 城市别名 → 标准名。
 *
 * 存在原因：后端/数据源（mock-data 及未来的真实抓取）常写简称「香港」「澳门」，
 * 而本表按规范使用「中国香港」「中国澳门」。若无别名映射，这类城市会被判为
 * "坐标未收录"而失去评估能力 —— 那是数据命名不一致导致的假阴性，不是真的没数据。
 */
const CITY_ALIASES = {
  香港: '中国香港',
  澳门: '中国澳门'
}

const CITY_MAP = CITY_COORDS.reduce((acc, c) => {
  acc[c.name] = c
  return acc
}, {})

/** 全部城市（按纬度由高到低，便于选择器展示） */
export function allCities() {
  return [...CITY_COORDS].sort((a, b) => b.lat - a.lat)
}

/** 按名称查城市，未收录返回 null。先解析别名，再查表。 */
export function findCity(name) {
  if (!name) return null
  const raw = String(name).trim()
  const key = CITY_ALIASES[raw] || raw
  return CITY_MAP[key] || null
}

/** 城市名 → 坐标对象；未收录返回 null */
export function cityCoords(name) {
  return findCity(name)
}

/** 取城市的规范显示名（别名 → 标准名）；未收录时原样返回，便于 UI 提示 */
export function canonicalCityName(name) {
  if (!name) return ''
  const raw = String(name).trim()
  return CITY_ALIASES[raw] || raw
}
