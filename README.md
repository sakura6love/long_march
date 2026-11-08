# 长征万里 · 薪火千秋

一个用 3D 地球讲述长征的交互作品：镜头从太空俯冲到中国西南，十二个历史节点按时间顺序亮起，点开任意一站，镜头飞过去，右侧浮出那一站的故事；走完十二站，中国在球面上被整体点亮，浮出国境金线与终章。

**单屏、无滚动、可离线运行**——所有贴图与数据都在本地 `public/` 里，断网也能完整演示。

> 更完整的设计说明、实现取舍与踩坑记录见 [概览.md](./概览.md)。

---

## 一、运行方式

```bash
cd long-march
npm install
npm run dev      # 开发：http://127.0.0.1:5173/
npm run build    # 构建：产物在 dist/，可直接静态部署（已设 base: './'，可放任意子目录）
npm run preview  # 本地预览构建产物
```

建议 Chrome / Edge 打开，需支持 WebGL 2。

**注意**：请通过静态服务器访问（`npm run dev` 或任意 http server），不要直接双击 `dist/index.html`——国境线数据用 `fetch` 读取，`file://` 协议会被浏览器拦截。

---

## 二、技术栈与第三方库说明

> 按赛事规则要求，逐项说明所用库的**名称、用途、在本项目中的具体作用**。

| 库 | 用途 | 在本项目中的具体作用 |
|---|---|---|
| **Vue 3** | 前端框架 | 组件化组织页面：地球视口、详情面板、事件叙事、路书、序章/终章各为一个组件，由 `App.vue` 串联三幕状态机（序章 / 俯瞰 / 终章）。 |
| **Vite** | 构建 / 开发服务器 | 开发热更新与生产打包；`base: './'` 使构建产物可部署在任意子路径。 |
| **globe.gl** | 功能性 3D 库（地球渲染） | 把 12 个经纬度节点绘制成球面光点；提供「经纬度 → 三维坐标 / 屏幕坐标」投影（`getCoords` / `getScreenCoords`）；管理球体材质、光照与相机。没有它就要自己写球面投影与 WebGL 渲染。 |
| **three.js** | 3D 引擎（globe.gl 的底层依赖） | 提供 WebGL 渲染器、球体几何、Phong 材质、方向光/环境光；项目的地球着色器（点亮/国境金线）通过 `onBeforeCompile` 注入到它的材质里；火线用 `Line2`/`LineGeometry` 绘制。 |

**未使用的部分（特此声明）**：本项目**没有**使用 Bootstrap、Element Plus、Ant Design、Tailwind CSS 或任何 UI 组件库、CSS 框架、现成页面模板；**没有**使用 CSS 预处理器（无 Sass/Less，样式全部是原生 CSS 手写，写在各自的 `.vue` 文件与 `src/style.css` 中）；**没有**加载任何外部字体或 CDN 资源。后端与内容管理系统：**未使用**（「点亮」记录存在浏览器 localStorage）。

---

## 三、目录结构

```
long-march/
├── index.html                 入口
├── vite.config.js             构建配置（base: './'）
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
│       └── AskPanel.vue       预设问答（离线）
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
| 左下角「问」 | 5 组已核对史实的预设问答，离线可用 |
| Esc | 逐级返回：面板 → 设置 |
| 双击画面 | 回到初始俯瞰机位 |
| 拖动 / 滚轮 | 自由旋转与缩放，不锁定流程 |

叙事播放：一次点击走一步——镜头飞到下一站、火线烧过去；途中遇到重要事件，画面压暗成星球剪影，背景换成该事件的史料影像（虚化），左下出现事件文字，右下提示「点击继续」。随时可点任意光点打断播放，不会补播。

---

## 五、数据与素材

- 历史节点：`src/data.js`，共 12 站（瑞金、于都、湘江、遵义、赤水、泸定桥、夹金山、草地、腊子口、吴起镇、直罗镇、会宁），坐标、日期、引文与正文均在此。
- 事件：`src/lib/story.js` 的 `STORY_EVENTS`，8 个事件，`at` 表示「火线烧到第几站」（整数=到站，小数=路上）。
- 分节文案与数字：`src/lib/storyExtra.js`，**全部由 `data.js` 原有描述重排而来，未新增无出处的断言**；存疑数字一律不写。
- 国界线：Natural Earth 1:50m `admin-0` 国家边界（公有领域 / CC0），经 `tools/build_border.py` 简化至约 1300 点，同时生成 4096×2048 遮罩。

| 素材 | 来源 | 许可 |
|---|---|---|
| `earth-8k.jpg` | Solar System Scope — Earth 8K texture | CC BY 4.0（已调色并重编码） |
| `earth-normal.png` / `earth-specular.png` | 同来源的地球法线 / 高光贴图 | CC BY 4.0 |
| `geo/china-border.json`、`bake/china.png` | Natural Earth 1:50m，本项目脚本处理 | 公有领域 / CC0 |
| `bake/ignition.png`、`bake/crust.png` | 本项目用离线脚本按路线与国境生成 | 自制 |
| `events/*.webp` | 当前为占位图，替换时保持同名覆盖即可 | — |
| 历史文字与日期 | 中共中央党史研究室《中国共产党历史》等公开史料整理 | 仅作叙述性引用 |

所有贴图均已下载到 `public/`，运行时不请求任何外部地址；字体使用系统宋体 / 等宽，不加载 webfont。

**清晰度说明**：地球贴图按「屏幕中心 1:1」反推分辨率——1080p、视高 0.72 时屏幕中心约 19.9 px/°，对应贴图宽度约 7147 px，因此选 8192 而非 4096；同时对贴图开启各向异性过滤（`anisotropy = maxAnisotropy`），避免斜视区域被 mipmap 抹平。

---

## 六、兼容与性能

- 桌面 1920×1080 为主要目标，1440×900 已验证落点误差 < 1px。
- 宽高 ≤ 768px：详情面板改为底部抽屉（`max-height: min(78vh, 660px)`，内部滚动，底部预留 `safe-area-inset`）。
- 支持 `prefers-reduced-motion`：关闭开场动画，直接落在最终机位。
- 体积：`public/` 4.3MB，`dist/` 6.4MB（全部资源本地化，首屏不依赖网络）。

---

## 七、已知限制

- `public/events/` 的 8 张事件背景图仍是占位图，替换同名文件即可，无需改代码。
- 终章「浮雕中国」定格图未提供（需要一张 4K 素材），当前终章只用球面点亮 + 国境金线。
- 史实核验受网络限制（部分党史站点返回 GBK 乱码），因此文案只保留可交叉印证的表述，未展开细节。
- 火线为单色 `Line2`（`vertexColors` 在 `Line2` 上不生效），颜色沿路线做的是整体色而非逐段渐变。

---

## 八、说明

- `tools/shot.mjs` 是开发期自动截图脚本（Puppeteer/CDP 驱动），不参与构建，也不打进 `dist`。
- `tools/*.py` 是离线生成脚本：改了路线或国界数据后重新运行即可，产物写入 `public/`，运行时只读。
- 调试全局（`window.__globe` / `window.__march` 等）被 `src/lib/debug.js` 用 `import.meta.env.DEV` 包裹，生产构建中不存在。
