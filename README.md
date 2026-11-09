# 长征万里 · 薪火千秋

一个用 3D 地球讲述长征的交互作品：镜头从太空俯冲到中国西南，十二个历史节点按时间顺序亮起，点开任意一站，镜头飞过去，右侧浮出那一站的故事；走完十二站，中国在球面上被整体点亮，浮出国境金线与终章。

**单屏、无滚动、核心内容完全离线**——所有贴图、史料与本地检索引擎都在仓库里；AI 问答是可选增强：没有后端、没有网络时，页面照常运行，问答自动切到本地档案模式，不弹任何报错。

> 更完整的设计说明、实现取舍与踩坑记录见 [概览.md](./概览.md)。

---

## 一、运行方式

**最快的方式（Windows，纯前端）**：双击 `start.bat`。它会检查 `dist/`（没有就构建），起一个本地静态服务器并自动打开浏览器。

手动方式：

```bash
cd long-march
npm install
npm run dev      # 开发：http://127.0.0.1:5173/
npm run build    # 构建：产物在 dist/，可直接静态部署（已设 base: './'，可放任意子目录）
npm run preview  # 本地预览构建产物
```

**带 AI 问答（可选）**：复制 `.env.example` 为 `.env`，填入 `DEEPSEEK_API_KEY`，然后：

```bash
node server.mjs   # 同端口同时提供 dist/ 静态文件与 /api/chat、/api/stats
```

没有填 key 也能启动：`/api/chat` 会立刻返回 `503 {"error":"no-key"}`，前端在几十毫秒内切到本地档案模式，界面只提示「通讯不稳 · 已回溯本地档案」，不会出现红字错误。

线上部署（推荐 Vercel，零运维）：

```bash
npm i -g vercel
vercel            # 首次：绑定项目，按提示添加环境变量 DEEPSEEK_API_KEY
vercel --prod     # 生产
```

`vercel.json` 已声明构建命令、输出目录与函数超时（`api/*.js` 30s）；Vercel 会把 `api/` 下的每个文件变成 Serverless Function，`/api/chat` 与页面同域，不存在跨域与混合内容问题。

只发 `dist/` 时，用任意静态服务器即可：`python -m http.server 8080 -d dist` 或 `npx serve dist`。

建议 Chrome / Edge 打开，需支持 WebGL 2。

**注意**：请通过静态服务器访问（`npm run dev` 或任意 http server），不要直接双击 `index.html`——源码入口需要 Vite 编译；`dist/index.html` 在 `file://` 下也会因模块脚本与 `fetch` 被浏览器拦截。

---

## 二、技术栈与第三方库说明

> 按赛事规则要求，逐项说明所用库/框架的**名称、用途、在本项目中的具体作用**。

| 库 / 服务 | 用途 | 在本项目中的具体作用 |
|---|---|---|
| **Vue 3** | 前端框架 | 组件化组织页面：地球视口、详情面板、事件叙事、路书、序章/终章各为一个组件，由 `App.vue` 串联三幕状态机（序章 / 俯瞰 / 终章）。 |
| **Vite** | 构建 / 开发服务器 | 开发热更新与生产打包；`base: './'` 使构建产物可部署在任意子路径。 |
| **globe.gl** | 功能性 3D 库（地球渲染） | 把 12 个经纬度节点绘制成球面光点；提供「经纬度 → 三维坐标 / 屏幕坐标」投影（`getCoords` / `getScreenCoords`）；管理球体材质、光照与相机。 |
| **three.js** | 3D 引擎（globe.gl 的底层依赖） | 提供 WebGL 渲染器、球体几何、Phong 材质、方向光/环境光；地球着色器（点亮/国境金线）通过 `onBeforeCompile` 注入；火线用 `Line2`/`LineGeometry` 绘制。 |
| **DeepSeek API**（外部模型服务，OpenAI 兼容） | 大语言模型 | 「AI 馆长」问答的生成端。请求由服务端转发，密钥只存在于服务端环境变量，不进前端产物。系统提示词限定「只依据馆藏资料、150 字内、不编年代人数」，并在请求里附带本地检索到的史料片段（RAG-lite），把回答锚定在可核查的文本上。 |
| **Vercel Functions**（`api/*.js`，Serverless 后端） | 后端运行环境 | 承载两个接口：`POST /api/chat`（转发模型流式输出）与 `GET/POST /api/stats`（站点统计）。不常驻、按请求唤醒，静态页面与接口同域。 |
| **Vercel KV / Upstash Redis**（可选） | 键值数据库 | 记录「累计提问次数」「累计点亮站数」，页脚显示。未配置时自动退回进程内存，不影响任何功能——这是**唯一**的持久化依赖，且完全可选。 |

**未使用的部分（特此声明）**：本项目**没有**使用 Bootstrap、Element Plus、Ant Design、Tailwind CSS 或任何 UI 组件库、CSS 框架、现成页面模板；**没有**使用 CSS 预处理器（无 Sass/Less，样式全部是原生 CSS 手写）；**没有**加载任何外部字体或 CDN 资源（运行时不请求第三方脚本）。

---

## 三、目录结构

```
long-march/
├── index.html                 入口
├── vite.config.js             构建配置（base: './'）
├── vercel.json                部署配置（构建命令 / 输出目录 / 函数超时）
├── .env.example               环境变量样例（只列键名，不含真实密钥）
├── server.mjs                 本地一体化服务器：dist/ + /api/*（无框架依赖）
├── api/                       Serverless 接口（Vercel 自动识别）
│   ├── chat.js                POST /api/chat：DeepSeek 流式转发 + 限流 + 无 key 快速 503
│   ├── stats.js               GET/POST /api/stats：累计提问数、点亮站数
│   └── _kv.js                 KV/Redis 封装，未配置时退回内存
├── README.md / 概览.md         说明与设计文档
├── public/                    贴图与烘焙数据（全部本地，离线可用，共 4.3MB）
│   ├── earth-8k.jpg           地球颜色贴图 8192×4096（重编码后 2.56MB）
│   ├── earth-normal.png       法线贴图 2048×1024
│   ├── earth-specular.png     海面高光遮罩 2048×1024
│   ├── stars.png              星空背景
│   ├── icons.svg              界面图标
│   ├── events/                8 张事件背景图（当前为占位图）
│   ├── geo/china-border.json  真实国界折线（Natural Earth 1:50m 简化，CC0）
│   └── bake/                  离线烘焙（由 tools/ 脚本生成）
│       ├── china.png          中国国境遮罩（4096×2048，用于「点亮」范围与边界）
│       ├── ignition.png       火线蔓延时间场（到路线的距离 + 行进进度）
│       └── crust.png          余烬纹理（值噪声裂缝）
├── src/
│   ├── App.vue                页面骨架与三幕状态机（序章 / 俯瞰 / 终章）
│   ├── style.css              设计令牌与全局基础样式（原生 CSS）
│   ├── data.js                12 个历史节点（经纬度、日期、引文、正文）
│   ├── lib/
│   │   ├── cameraRig.js       相机机位与飞行（俯冲、拉远、双击复位）
│   │   ├── routePath.js       长征路线控制点
│   │   ├── chapters.js        四个章节（出发 / 转折 / 天险 / 北上）的文案
│   │   ├── routeLine.js       火线几何、进度推进、弧长采样、行程钉坐标
│   │   ├── story.js           8 个事件（时间、地点、正文、三条事实、配图）
│   │   ├── storyExtra.js      12 站的分节文案与数字（由原描述重排，不新增断言）
│   │   ├── archive.js         本地档案检索（12 站 + 8 事件，双字倒排 + 打分）
│   │   ├── ai.js              流式问答客户端（首字节 4.5s / 总 30s，可中断）
│   │   ├── audio.js           音效（可选，默认关闭）
│   │   ├── api.js             数据层收口（点亮记录，localStorage）
│   │   └── debug.js           仅开发期生效的调试全局挂载
│   └── components/
│       ├── EarthGlobe.vue     地球、火线、节点/事件锚点、着色器、国境线、开场动画
│       ├── DetailPanel.vue    右侧详情面板 / 手机底部抽屉
│       ├── EventScene.vue     事件叙事卡（背景图 + 文字）
│       ├── EventRail.vue      底部「路书」时间轴（按真实弧长排布）
│       ├── ChapterCard.vue    章节卡（出发 / 转折 / 会师）
│       ├── FinaleScreen.vue   终章三行字与印章
│       ├── StartScreen.vue    序章
│       ├── SettingsPanel.vue  设置（音效 / 减少动效 / 重走）
│       └── AskPanel.vue       AI 馆长问答（在线 / 本地档案 / 离线三态）
└── tools/                     离线生成脚本（不参与构建）
    ├── build_border.py        Natural Earth → china-border.json + bake/china.png
    ├── countries-50m.json     国界原始数据（Natural Earth 1:50m，CC0）
    ├── china-provinces.json   省级边界原始数据（备用）
    └── shot.mjs               开发期自动截图脚本
```

---

## 四、交互说明

| 操作 | 效果 |
|---|---|
| 打开页面 | 整球悬于深空 → 俯冲到中国 → 12 个光点依次亮起 |
| 悬停光点 | 展开该站地名（同屏只展开一张） |
| 点击光点 | 镜头飞到该站，详情面板滑出 |
| 面板 ← → | 按时间顺序上一站 / 下一站 |
| 点亮此站 | 记录到本机，光点常亮一层金晕；再点可取消 |
| 左下角「问」 | 打开 AI 馆长：可直接提问，也可点三个预设问题；后端不可用时自动切本地档案 |
| Esc | 逐级返回：面板 → 设置 |
| 双击画面 | 回到初始俯瞰机位 |
| 拖动 / 滚轮 | 自由旋转与缩放，不锁定流程 |

叙事播放：一次点击走一步——镜头飞到下一站、火线烧过去；途中遇到重要事件，画面压暗成星球剪影，背景换成该事件的史料影像（虚化），左下出现事件文字，右下提示「点击继续」。随时可点任意光点打断播放，不会补播。

---

## 五、AI 问答与降级策略

这是本项目唯一的「在线能力」，按「**即使整条链路都挂了，也不能出现报错界面**」来设计。

### 5.1 三层降级

| 状态 | 触发条件 | 用户看到什么 |
|---|---|---|
| **在线** | `POST /api/chat` 在 4.5s 内返回首字节，随后流式吐字 | 打字机逐字出现，末尾附「出处 第 04 站 遵义 · 第 03 站 湘江」 |
| **档案模式** | 超时 / 5xx / 断流 / 未配密钥（503） | 顶部一行小字「通讯不稳 · 已回溯本地档案」，下面是同一问题在本地史料里的答案，同样带出处 |
| **离线** | `navigator.onLine === false` | 「当前离线 · 读取本地馆藏」，不发起任何请求 |

三个状态都**不弹错误框、不出现英文异常、不影响其他交互**。降级不是「兜底文案」，而是把同一份馆藏（12 站 + 8 事件，约 15KB）在本地重新检索、按句重组，所以答案仍然具体、可核对。

### 5.2 为什么不用「前端直连模型」

- 密钥会进入构建产物，任何人打开 DevTools 都能拿走；
- 前端直连第三方域名，会遇到 CORS 与混合内容（https 页面请求 http）问题；
- 没有地方做限流与并发保护。

### 5.3 服务端做了什么

`api/chat.js`：

1. 校验 `DEEPSEEK_API_KEY`，缺失立即 503（避免前端干等超时）；
2. 简单限流（同一 IP 60 秒 8 次，超限 429）；
3. 把前端传来的问题与本地检索片段拼成 messages，系统提示词限定「只依据馆藏、150 字内、不编年代人数」；
4. 以 `stream: true` 请求 DeepSeek，把上游 SSE 逐块转成自己的 `data: {"delta":"…"}`，最后 `data: [DONE]`；
5. 顺带累加一次提问计数（KV 未配置时存内存）。

### 5.4 环境变量

见 `.env.example`（只列键名）：

```
DEEPSEEK_API_KEY=      # 必填，仅服务端
DEEPSEEK_MODEL=        # 可选，默认 deepseek-chat
DEEPSEEK_BASE_URL=     # 可选，默认 https://api.deepseek.com/chat/completions
KV_REST_API_URL=       # 可选，Vercel KV / Upstash
KV_REST_API_TOKEN=     # 可选
```

`.env` 已加入 `.gitignore`，**不会**进入提交包。

---

## 五之二、部署（Cloudflare Pages + Functions）

线上地址：<https://long-march.pages.dev>

本项目是 **Vite 静态站 + Pages Functions**，不是 Worker。部署步骤：

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**，选 `sakura6love/long_march`。
   若只看到 Workers 向导，点页面底部 *"Need to use the legacy Pages workflow? Continue to Pages"*。
2. 构建配置：
   - Framework preset：`None`（列表里没有单独的 Vite）
   - Build command：`npm ci && npm run build`
   - Build output directory：`dist`
   - Root directory：留空（仓库根即项目根）
3. 环境变量（Settings → Variables and Secrets）：
   - `DEEPSEEK_API_KEY`，类型 **Secret**
   - `DEEPSEEK_MODEL` = `deepseek-chat`，类型 Text
   - 保存后必须 **Deployments → ⋯ → Retry deployment** 才生效
4. KV（可选）：Settings → Functions → KV namespace bindings，变量名 `STATS`。
   不绑也能用，只是 `/api/stats` 返回 `available:false`、统计存内存、重启归零。
5. 验证：
   ```bash
   curl -s https://long-march.pages.dev/api/stats
   curl -N -X POST https://long-march.pages.dev/api/chat \
     -H 'content-type: application/json' \
     -d '{"q":"遵义会议为什么是转折点","context":""}'
   ```

`server.mjs` 是本地等价实现（同 `api/chat`、`api/stats` 路由 + 静态托管），用于离线演示；线上由 `functions/api/*` 接管。

### 四层问答（线上实测）

| 层 | 触发 | 行为 | 依赖 |
|---|---|---|---|
| L0 馆藏 | 点问题列表（10 条） | 前端写死答案，0 请求 | 无 |
| L1 档案 | 自由输入 | `localAnswer()` 本地检索，<30ms | 无 |
| L2 联网 | 点「再问一次 · 联网」 | SSE 流式，首字节 7s / 总 30s 超时，失败静默回退 L1 | `DEEPSEEK_API_KEY` |
| L3 统计 | 点亮站点 | `POST /api/stats {lights}`，按访客哈希去重、只升不降 | KV（可选） |

## 六、数据与素材

- 历史节点：`src/data.js`，共 12 站（瑞金、于都、湘江、遵义、赤水、泸定桥、夹金山、草地、腊子口、吴起镇、直罗镇、会宁），坐标、日期、引文与正文均在此。
- 事件：`src/lib/story.js` 的 `STORY_EVENTS`，8 个事件，`at` 表示「火线烧到第几站」（整数=到站，小数=路上）。
- 分节文案与数字：`src/lib/storyExtra.js`，**全部由 `data.js` 原有描述重排而来，未新增无出处的断言**；存疑数字一律不写。
- 本地检索语料：`src/lib/archive.js` 直接由上面两份数据生成，不额外维护第三份文案。
- 国界线：Natural Earth 1:50m `admin-0` 国家边界（公有领域 / CC0），经 `tools/build_border.py` 简化至约 1300 点，同时生成 4096×2048 遮罩。

| 素材 | 来源 | 许可 |
|---|---|---|
| `earth-8k.jpg` | Solar System Scope — Earth 8K texture | CC BY 4.0（已调色并重编码） |
| `earth-normal.png` / `earth-specular.png` | 同来源的地球法线 / 高光贴图 | CC BY 4.0 |
| `geo/china-border.json`、`bake/china.png` | Natural Earth 1:50m，本项目脚本处理 | 公有领域 / CC0 |
| `bake/ignition.png`、`bake/crust.png` | 本项目用离线脚本按路线与国境生成 | 自制 |
| `events/*.webp` | 当前为占位图，替换时保持同名覆盖即可 | — |
| 历史文字与日期 | 中共中央党史研究室《中国共产党历史》等公开史料整理 | 仅作叙述性引用 |

所有贴图均已下载到 `public/`，运行时不请求任何外部地址；字体使用系统宋体 / 等宽，不加载 webfont。唯一的运行时外部请求是 `/api/chat`（同域），而它失败时不影响任何内容。

**清晰度说明**：地球贴图按「屏幕中心 1:1」反推分辨率——1080p、视高 0.72 时屏幕中心约 19.9 px/°，对应贴图宽度约 7147 px，因此选 8192 而非 4096；同时对贴图开启各向异性过滤（`anisotropy = maxAnisotropy`），避免斜视区域被 mipmap 抹平。

---

## 七、兼容与性能

- 桌面 1920×1080 为主要目标，1440×900 已验证落点误差 < 1px。
- 宽高 ≤ 768px：详情面板改为底部抽屉（`max-height: min(78vh, 660px)`，内部滚动，底部预留 `safe-area-inset`）。
- 支持 `prefers-reduced-motion`：关闭开场动画，直接落在最终机位。
- 体积：`public/` 4.3MB，`dist/` 约 6.4MB（全部资源本地化，首屏不依赖网络）。
- 慢网策略：问答首字节最多等 4.5 秒，超时立刻切本地档案；页面其他部分从不等待网络。

---

## 八、已知限制

- `public/events/` 的 8 张事件背景图仍是占位图，替换同名文件即可，无需改代码。
- 终章「浮雕中国」定格图未提供（需要一张 4K 素材），当前终章只用球面点亮 + 国境金线。
- 史实核验受网络限制（部分党史站点返回 GBK 乱码），因此文案只保留可交叉印证的表述，未展开细节。
- 火线为单色 `Line2`（`vertexColors` 在 `Line2` 上不生效），颜色沿路线做的是整体色而非逐段渐变。
- AI 回答依赖第三方模型，**内容质量不可完全保证**；因此系统提示词强制「只依据馆藏、不编年代人数」，并在回答末尾给出馆藏出处，方便核对。未配置密钥时，功能退化为本地检索，不影响演示完整性。

---

## 九、说明

- `tools/shot.mjs` 是开发期自动截图脚本（Puppeteer/CDP 驱动），不参与构建，也不打进 `dist`。
- `tools/*.py` 是离线生成脚本：改了路线或国界数据后重新运行即可，产物写入 `public/`，运行时只读。
- 调试全局（`window.__globe` / `window.__march` 等）被 `src/lib/debug.js` 用 `import.meta.env.DEV` 包裹，生产构建中不存在。
- 提交包不含 `node_modules/`、`.env`、`.vercel/`、开发截图目录。
