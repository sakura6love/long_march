# 长征万里 · 薪火千秋

> 2026 武汉大学「零杯」网页设计大赛参赛作品 · 主题三
> 线上地址：<https://long-march.pages.dev>

一个可以在三维地球上重走长征路的交互网页：1934—1936，十二个坐标、八个关键事件、两年两万五千里。转动地球、逐站点亮、读每一处的故事；它也可以回答你关于长征的提问。

---

## 一、运行方式

需要 Node.js ≥ 20.19。

```bash
npm ci
npm run dev        # 本地开发，默认 http://localhost:5173
npm run build      # 产物在 dist/
npm start          # 用内置 server.mjs 同时托管 dist 与 /api（默认 8080）
```

Windows 用户可直接双击 `start.bat`（自动构建并打开浏览器）。

> 说明：核心内容（地球、路线、十二站、八事件、离线问答）完全不依赖后端；AI 问答是可选增强，没有密钥时自动降级为本地档案回答，不会报错。

## 二、技术栈与第三方库说明（比赛要求逐项注明）

| 名称 | 版本 | 用途 | 在项目中的具体作用 |
|---|---|---|---|
| Vue 3 | ^3.5 | 工程框架 | 组件化组织页面与状态（`App.vue` 管理 `screen / litIds / showingEvent`） |
| Vite | ^7 | 构建工具 | 开发服务器、打包、资源哈希与按需压缩 |
| globe.gl | ^2.4x | 功能性 3D 库 | 渲染三维地球、经纬度坐标、路径与标签锚点 |
| three.js | 随 globe.gl | 功能性 3D 库 | 地球材质（Phong + 法线/高光贴图）、`Line2` 火线、星空 |
| d3-geo 相关（随 globe.gl） | — | 几何计算 | 经纬度到三维坐标、路径插值 |

**没有使用** Bootstrap、Element Plus、Vue Element、Tailwind 等任何“预设样式 / 组件库”，所有界面元素（面板、按钮、抽屉、路书）均为手写 CSS。

后端（可选）：Cloudflare Pages Functions（`functions/api/*.js`），调用 DeepSeek Chat 完成问答；KV 存储点亮与提问计数。未配置时自动降级，不影响主流程。

## 三、合规声明

- 未引入预设样式库或现成页面模板；
- 使用功能性库的原因与用途已在上表列明；
- 所有图片素材来源见「八、素材与授权」；
- AI 生成内容（事件配图）均在图注标注为“示意图”；
- 代码可独立运行，无隐藏的外部依赖。

## 四、功能清单

1. **三维地球**：8K 地表贴图 + 法线/高光，星空、暗角、大气光；拖拽旋转、滚轮缩放、双击复位。
2. **长征路线**：十二个站点沿真实经纬度排布，一条火线按弧长生长；十二团火花标记，未点亮为空心描边，点亮后实心并保留暖光。
3. **八个关键事件**：湘江、遵义、赤水、金沙江、泸定桥、夹金山、草地、会宁；事件页背景图铺在地球背后（不是压在球面上），随站点切换淡入。
4. **站点详情**：每站一段导语、两小节正文、三个数字（时间/兵力/序号）、上一站/下一站。
5. **问答四层降级**：预设问答（前端 0 网络）→ 本地档案检索（<30ms）→ 手动联网流式（DeepSeek）→ 统计上报（KV）。
6. **终章**：十二站全部点亮后自动进入，保留中国边界金线，三行结语与印章。
7. **响应式**：桌面 1920/1440、窄屏 720、手机竖屏 390/412、横屏 844×390 均有独立版式。

## 五、页面规格与适配

- 设计基准：1920×1080；已实测 1440×900、1492×762、720 宽、412×915、390×844、844×390。
- 浏览器：Chrome 129（主）；Safari/Edge 作了兼容处理（`visualViewport`、`interactive-widget` 兜底）。
- 慢网：地球贴图已转 WebP（2.69MB → 1.53MB），事件图 8 张合计约 1MB；首屏在 100KB/s 下约 30 秒可交互，期间显示序章而不是白屏。
- 移动端：问答为底部抽屉，键盘弹起时用 `visualViewport` 重排；安卓返回键只关抽屉。

## 六、目录结构

```
long_march/
├─ public/            贴图、事件图、边界数据、robots/sitemap、OG 图
├─ src/
│  ├─ components/     EarthGlobe / EventScene / DetailPanel / AskPanel / FinaleScreen …
│  ├─ lib/            story.js（事件与站点文案）、cameraRig.js、ai.js、archive.js、presets.js
│  ├─ App.vue         全局状态与页面编排
│  └─ style.css       设计令牌（颜色、字体、动效曲线）
├─ functions/api/     Cloudflare Pages Functions（chat / stats）
├─ server.mjs         本地静态服务器 + API
└─ README.md / 概览.md
```

## 七、设计说明

- **字体层级**：宋体只用于标题（40/30px），正文统一黑体（15/13px），元信息用暖灰 `#a89f8c`；金色 `#c4a35a` 只出现在线、kicker 与 hover。
- **色彩**：底色 `#0b0f19`，正文 `#f3f1e6`，火线 `#8b1c1c`，金色仅作强调。
- **动效**：统一 `cubic-bezier(.25,1,.5,1)`；火线生长、火花点亮、背景交叉淡入都做了“先解码再显示”，避免闪烁。

## 八、素材与授权

- 地球贴图：NASA Blue Marble 系列（公有领域）衍生处理；
- 中国边界：Natural Earth / world-atlas（公有领域），离线烘焙为 `public/geo/china-border.json`；
- 事件配图 8 张：AI 生成（示意图），仅用于氛围，不代表真实历史影像；
- 字体：使用系统字体栈（Songti SC / PingFang SC / 思源系列），不额外分发字体文件。

## 九、部署

Cloudflare Pages + Functions：

- Build command：`npm ci && npm run build`
- Output directory：`dist`
- 环境变量：`DEEPSEEK_API_KEY`（Secret）、`DEEPSEEK_MODEL=deepseek-chat`
- KV 绑定：`STATS`

修改环境变量后需要重新部署（Deployments → Retry deployment）才生效。
