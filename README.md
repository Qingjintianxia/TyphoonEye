# TyphoonEye 台风预警系统

面向沿海城市的台风监测与预警处置系统：台风列表与地图可视化、路径回放、多台风对比、城市影响评估、地理围栏告警，以及「预警 → 工单 → 处置 → 闭环」的业务闭环与消息中心。

## 技术栈

- 前端：Vue 3 + Vite 5 + Pinia + ECharts 5 + Leaflet 1.9 + vue-router 4
- 后端：Express 4 + jsonwebtoken + bcryptjs + helmet + express-rate-limit
- 存储：JSON 文件持久层（原子写 + 串行写锁）
- 底图：天地图（国内合规，无境外 CDN 依赖）

## 快速开始

```bash
npm install
npm run dev:all        # 同时启动后端 3000 与前端 5173
```

也可直接双击 `scripts/start-dev.bat`。

浏览器打开 http://localhost:5173/ ，演示账号 `demo` / `demo123`。

> 只起前端会导致所有 `/api` 请求 401，两个服务必须同时运行。
> 前端只绑定 `localhost`，用 `127.0.0.1` 访问会连不上。

## 环境变量

复制 `.env.example` 为 `.env` 后按需填写：

| 变量 | 说明 |
|---|---|
| `PORT` | 后端端口，默认 3000 |
| `NODE_ENV` | `development` / `production` |
| `JWT_SECRET` | JWT 签名密钥，生产环境必填，缺失则拒绝启动 |
| `JWT_EXPIRES_IN` | token 有效期，默认 7d |
| `CORS_ORIGINS` | 允许的前端来源，逗号分隔 |
| `VITE_TIANDITU_KEY` | 天地图浏览器端密钥 |

无 `VITE_TIANDITU_KEY` 时地图自动降级为海图占位，属设计行为。

## 命令

| 命令 | 说明 |
|---|---|
| `npm run dev:all` | 同时启动前后端 |
| `npm run dev` / `npm run server` | 单独启动前端 / 后端 |
| `npm run build` | 生产构建 |
| `npm run test` | 单元测试 |
| `npm run test:api` | 接口功能测试（自带 3101 端口与数据隔离） |
| `npm run test:all` | 全部测试 |

## 目录结构

```
server/    Express 后端：路由、中间件、规则引擎、工单与消息服务
src/       Vue 3 前端：视图、组件、store、composables、常量与工具
tests/     单元测试与接口功能测试
docs/      规范文档与软著登记材料
scripts/   开发启动脚本
```

## 说明

- 底图创建与切换的唯一入口是 `src/config/map.js`，组件不自行拼装瓦片地址。
- `server/lib/geo.js` 与 `src/utils/geo.js`、`server/constants/ticket.js` 与 `src/constants/ticket.js` 为同源两份（前后端模块体系不同），改动需同步。
- 地理计算对非法输入一律返回 `null`，绝不返回 0 或 NaN。
