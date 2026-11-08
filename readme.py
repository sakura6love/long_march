import io
p='README.md'
s=io.open(p,encoding='utf-8').read()
s=s.replace("""| **three.js** | 3D 引擎（globe.gl 的底层依赖） |""",
"""| **Sass** | CSS 预处理器（工程工具） | 组件样式用 `.scss` 书写（嵌套、变量），构建时编译为普通 CSS；不参与运行时。 |
| **three.js** | 3D 引擎（globe.gl 的底层依赖） |""")
old_tree_start = s.index("```\nlong-march/")
old_tree_end = s.index("```", old_tree_start+3)+3
tree = """```
long-march/
├── index.html                 入口
├── public/                    贴图与烘焙数据（全部本地，离线可用）
│   ├── earth-8k.jpg           地球颜色贴图 8192×4096（实际使用）
│   ├── earth-normal.png       法线贴图 2048×1024
│   ├── earth-specular.png     海面高光遮罩 2048×1024
│   ├── stars.png              星空背景
│   └── bake/                  离线烘焙（脚本生成，见 tools/）
│       ├── china.png          中国国境遮罩（10bit 羽化，用于「点亮」边界）
│       ├── ignition.png       火线蔓延时间场（到路线的距离 + 行进进度）
│       └── crust.png          焦土/余烬纹理（值噪声裂缝）
├── src/
│   ├── App.vue                页面骨架与三幕状态机（序章 / 俯瞰 / 终章）
│   ├── data.js                12 个历史节点（经纬度、日期、文案）
│   ├── lib/
│   │   ├── cameraRig.js       相机机位与飞行（俯冲、拉远、双击复位）
│   │   ├── routePath.js       长征路线控制点（主线 + 四渡回环）
│   │   ├── routeLine.js       火线几何、进度推进、行程钉坐标
│   │   ├── story.js           8 个事件（时间、地点、正文、三条事实）
│   │   └── api.js             数据层收口（点亮记录，localStorage）
│   └── components/
│       ├── EarthGlobe.vue     地球、火线、节点/事件锚点、着色器、开场动画
│       ├── DetailPanel.vue    右侧详情面板 / 手机底部抽屉
│       ├── EventScene.vue     事件叙事卡（图 + 三段文字）
│       ├── EventRail.vue      底部「路书」进度条
│       ├── ChapterCard.vue    章节卡（出发 / 转折 / 会师）
│       ├── FinaleScreen.vue   终章三行字与印章
│       ├── StartScreen.vue    序章
│       └── AskPanel.vue       预设问答（离线）
```"""
s = s[:old_tree_start] + tree + s[old_tree_end:]
s = s.rstrip() + """

---

## 四、素材与数据来源

| 素材 | 来源 | 许可 |
|---|---|---|
| `earth-8k.jpg` | Solar System Scope — Earth 8K texture | CC BY 4.0 |
| `earth-normal.png` / `earth-specular.png` | 同来源的地球法线/高光贴图 | CC BY 4.0 |
| `bake/china.png`、`bake/ignition.png`、`bake/crust.png` | 本项目用离线脚本（PIL / numpy）按国境多边形与路线控制点生成 | 自制 |
| 历史文字与日期 | 中共中央党史研究室《中国共产党历史》等公开史料整理 | 仅作叙述性引用 |
"""
io.open(p,'w',encoding='utf-8').write(s)
print('readme updated')
