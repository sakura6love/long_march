<script setup>
/**
 * 《长征万里·薪火千秋》— 地球主视口
 *
 * P1「标签稳定化」四条铁律，全部落在本文件里：
 * 1. 锚点严格 0×0、卡片绝对定位 —— 窗口尺寸变化不会把光点"拉偏"；
 * 2. 转到球体背面的标签直接淡出，不会"横穿"到正面来；
 * 3. 卡片默认隐藏，只有悬停 / 键盘聚焦 / 选中时才出现，同屏最多一张；
 * 4. 靠近屏幕右缘的卡片自动翻到左侧，避免被视口裁掉。
 *
 * 绝对禁止：把 globe 实例放进 ref / reactive。
 * WebGL 对象一旦被 Vue 深度代理，浏览器会直接卡死白屏，这里只能使用 shallowRef。
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Globe from 'globe.gl'
import { AmbientLight, DirectionalLight } from 'three'
import longMarchNodes from '../data.js'
import { createCameraRig, FRAME } from '../lib/cameraRig.js'

const props = defineProps({
  // 已点亮的站点 id，用来给光点加一层更暖的光晕
  litIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['select'])

// 只让 DOM 容器参与 Vue 响应式；WebGL 实例使用 shallowRef，避免深度代理。
const globeContainer = ref(null)
const globe = shallowRef(null)

// 相机机位：三个旋钮（altitude / pitch / viewOffset）全部收口在 lib/cameraRig.js。
let cameraRig = null

// —— 渲染循环共享的普通变量，绝不进入响应式系统 ——
let resizeObserver = null
let rotationTimer = null
let frameHandle = 0

// 当前选中的节点 id：它的卡片会保持展开。
let activeId = null
// 悬停到别的节点时，被临时收起的"选中卡片"；指针移开即还原。
let hoverSuspended = null

// 标签 DOM ↔ 经纬度的对照表，供逐帧判定遮挡与左右翻转。
const labelRecords = []

// 卡片翻面的安全边距：卡片宽度 + 视口留白，超出就翻到左侧。
const FLIP_SAFE_MARGIN = 168

function resizeGlobe() {
  if (!globe.value || !globeContainer.value) return

  const { clientWidth, clientHeight } = globeContainer.value
  if (clientWidth > 0 && clientHeight > 0) {
    globe.value.width(clientWidth).height(clientHeight)
    cameraRig?.reframe()
  }
}

/**
 * 背面遮挡判定。
 *
 * 节点 P 在球面上、相机 C 在球外，P 可见的充要条件是：
 *   dot(C - P, P) > 0 ，即 dot(C, P) > |P|²
 * 阈值乘以 1.004 留出一点余量，避免正好贴在边缘时来回闪烁。
 */
function isFacingCamera(lat, lng) {
  if (!globe.value) return false

  // 注意：getCoords 返回的是普通对象 { x, y, z }，不是 THREE.Vector3，
  // 不能调用 lengthSq()，这里手动算模长平方。
  const point = globe.value.getCoords(lat, lng, 0.01)
  const camera = globe.value.camera().position
  const dot = point.x * camera.x + point.y * camera.y + point.z * camera.z
  const radiusSq = point.x * point.x + point.y * point.y + point.z * point.z

  return dot > radiusSq * 1.004
}

/**
 * 逐帧刷新标签状态：只在相机变化时才真正改变 class，
 * classList.toggle 传入第二个参数是幂等的，不会触发多余重排。
 */
// 用 Set 存一份，避免每帧对 12 个节点做 includes
let litIdSet = new Set()
watch(
  () => props.litIds,
  (ids) => {
    litIdSet = new Set(ids || [])
  },
  { immediate: true, deep: true },
)

function updateLabelStates() {
  if (!globe.value || labelRecords.length === 0) return

  const width = globe.value.width()
  const flipLine = width - FLIP_SAFE_MARGIN

  for (const record of labelRecords) {
    const facing = isFacingCamera(record.lat, record.lng)
    record.el.classList.toggle('is-far', !facing)
    // 点亮过的站点，光点常亮一层金晕
    record.el.classList.toggle('is-lit', litIdSet.has(record.id))

    if (!facing) continue

    const screen = globe.value.getScreenCoords(record.lat, record.lng, 0.01)
    if (screen) {
      record.el.classList.toggle('is-flipped', screen.x > flipLine)
    }
  }
}

function tick() {
  frameHandle = requestAnimationFrame(tick)
  // 位移被库内部清掉时立刻补回，保证"点恒在 30% 那条线上"。
  cameraRig?.ensureOffset()
  updateLabelStates()
}

/** 切换选中态：保证任何时刻最多只有一个 is-active。 */
function setActive(id) {
  activeId = id
  hoverSuspended = null

  for (const record of labelRecords) {
    record.el.classList.toggle('is-active', record.id === id)
  }
}

/**
 * 让镜头飞向某个节点（点击、面板上的 ← → 都走这里）。
 * 只做一件事：把"选中"这件事在地球这一侧执行完，再把节点抛给 App。
 */
function focusNode(pointData) {
  if (!globe.value) return

  // 用户在开场动画途中点了光点：立刻收掉剩余节奏，别让"点亮"追着镜头跑。
  clearIntro()
  revealAll()

  const controls = globe.value.controls()
  controls.autoRotate = false
  window.clearTimeout(rotationTimer)

  setActive(pointData.id)

  // 统一机位：飞行 1.6s，落点固定在屏高 30% 的"主角线"上。
  // 不再用 pointOfView —— 它只管中心，管不了"点落在哪条线上"。
  cameraRig?.flyTo({
    lat: pointData.lat,
    lng: pointData.lng,
    altitude: cameraRig.state.altitude,
    duration: FRAME.flightMs,
  })

  emit('select', pointData)

  rotationTimer = window.setTimeout(() => {
    if (globe.value) {
      globe.value.controls().autoRotate = true
    }
  }, 4200)
}

function handleNodeSelect(pointData) {
  focusNode(pointData)
}

// 面板上的"上一站 / 下一站"从外部调用它。
defineExpose({ focusNode })

/**
 * 外层元素严格保持 0x0。
 * CSS2DRenderer 会把零尺寸元素的原点投影到经纬度位置，
 * 圆点、引线和卡片全部从该原点展开，因此不会被卡片宽度拉偏。
 */
function createChineseLabel(pointData) {
  const anchor = document.createElement('button')
  anchor.type = 'button'
  anchor.className = 'march-label-anchor is-pending'
  anchor.dataset.nodeId = pointData.id
  anchor.setAttribute('aria-label', `查看${pointData.name}历史节点`)
  anchor.innerHTML = `
    <span class="march-label-beam" aria-hidden="true"></span>
    <span class="march-label-node" aria-hidden="true"></span>
    <span class="march-label-card">
      <span class="march-label-code">${pointData.id.toUpperCase()}</span>
      <strong>${pointData.name}</strong>
      <small>${pointData.date}</small>
    </span>
  `

  anchor.addEventListener('click', (event) => {
    event.stopPropagation()
    handleNodeSelect(pointData)
  })

  // 悬停到别的节点时，先收起已选中节点的卡片，保证"同屏最多一张卡片"。
  anchor.addEventListener('pointerenter', () => {
    if (!activeId || activeId === pointData.id) return

    hoverSuspended = labelRecords.find((record) => record.id === activeId) || null
    hoverSuspended?.el.classList.remove('is-active')
  })

  anchor.addEventListener('pointerleave', () => {
    hoverSuspended?.el.classList.add('is-active')
    hoverSuspended = null
  })

  labelRecords.push({
    el: anchor,
    id: pointData.id,
    lat: pointData.lat,
    lng: pointData.lng,
  })

  return anchor
}

/** 开场时临时放宽的相机距离上限（altitude 2.0 ≈ 3 个地球半径）。 */
const INTRO_MAX_DISTANCE = 320

/** 开场动画的定时器，卸载或用户提前点击时统一清空。 */
let introTimers = []

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clearIntro() {
  introTimers.forEach((id) => window.clearTimeout(id))
  introTimers = []
}

/** 直接点亮全部光点（无动画场景、减少动态偏好）。 */
function revealAll() {
  for (const record of labelRecords) {
    record.el.classList.remove('is-pending')
  }
}

/**
 * 开场编排：先从"整球"起步（altitude 2.45，球缘弧线正好压在画面上沿），
 * 再俯冲到 altitude 0.72，最后让 12 个光点按时间顺序依次点亮。
 * 用户随时可以拖动或点击，提前点击会立刻中断后续节奏。
 */
function startIntro() {
  if (prefersReducedMotion()) {
    cameraRig.apply({ lat: 35.6921, lng: 105.0533, altitude: FRAME.altitude })
    revealAll()
    return
  }

  const controls = globe.value.controls()
  controls.autoRotate = true
  // 相机在 mount 时已经退到整球（见 onMounted），这里只等一拍再俯冲。
  controls.maxDistance = INTRO_MAX_DISTANCE

  introTimers.push(
    window.setTimeout(() => {
      cameraRig.flyTo({
        lat: 35.6921,
        lng: 105.0533,
        altitude: FRAME.altitude,
        duration: 2000,
      })

      introTimers.push(
        window.setTimeout(() => {
          controls.autoRotate = false
          controls.maxDistance = 172
          labelRecords.forEach((record, index) => {
            introTimers.push(
              window.setTimeout(() => {
                record.el.classList.remove('is-pending')
                record.el.classList.add('is-revealed')
              }, index * 80),
            )
          })
        }, 2100),
      )
    }, 600),
  )
}

onMounted(() => {
  if (!globeContainer.value) return

  // 贴图放在 public 里随包发布：比赛现场断网也能立刻出图，
  // 不再等 unpkg 的 1.4MB（首屏黑屏两秒会毁掉开场）。
  const assetBase = import.meta.env.BASE_URL

  globe.value = Globe()(globeContainer.value)
    .backgroundColor('rgba(0, 0, 0, 0)')
    .globeImageUrl(`${assetBase}earth-blue-marble.jpg`)
    .bumpImageUrl(`${assetBase}earth-topology.png`)
    .showAtmosphere(true)
    .atmosphereColor('#4b7eb3')
    .atmosphereAltitude(0.13)
    // 保持原有所有节点的经纬度与标签高度不变。
    .htmlElementsData(longMarchNodes)
    .htmlLat((point) => point.lat)
    .htmlLng((point) => point.lng)
    .htmlAltitude(0.01)
    .htmlTransitionDuration(0)
    .htmlElement(createChineseLabel)

  const scene = globe.value.scene()

  // 光照只有一个目的：把山脊刻出来，而不是把地球照亮。
  // 环境光偏暖、压得很低，保证背光那一侧仍是深蓝而不是死黑。
  scene.add(new AmbientLight(0x4a4a3f, 0.16))

  // 主光：仰角约 9°，从西南方斜切过来 —— 山体阴影被拉长，
  // 近景才有"摸得到"的起伏；再高就变成正午平光，地形立刻变平。
  const terrainLight = new DirectionalLight(0xffd9a2, 2.35)
  terrainLight.position.set(-180, 30, 125)
  scene.add(terrainLight)

  // 补光：极暗的冷色，只负责勾出右上方的球缘，避免边缘融进背景。
  const rimLight = new DirectionalLight(0x5b7fa6, 0.26)
  rimLight.position.set(120, 18, -160)
  scene.add(rimLight)

  const globeMaterial = globe.value.globeMaterial()
  // 微暖的基色乘上去，把贴图里过饱和的蓝绿压回 UI 的暖灰调子。
  globeMaterial.color.set('#efe4cd')
  // 近景靠 bump 撑立体：稍加深，山脊在 30% 主角线附近才立得起来。
  globeMaterial.bumpScale = 0.34
  globeMaterial.roughness = 0.9
  globeMaterial.metalness = 0.02
  globeMaterial.emissive.set('#121821')
  globeMaterial.emissiveIntensity = 0.05
  globeMaterial.needsUpdate = true

  // 机位统一交给 cameraRig。
  cameraRig = createCameraRig(globe.value)

  const controls = globe.value.controls()
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.08
  controls.enableZoom = true
  // 视高锁在 altitude 0.45 ~ 0.72（distance 145 ~ 172）：
  // 再近就贴地糊成一片，再远就看不清路线。
  controls.minDistance = 145
  controls.maxDistance = 172
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.07

  resizeGlobe()

  // 首帧就站在"整球"的位置：球缘弧线正好压在画面上沿 12% 处。
  // 先给 OrbitControls 放宽距离上限，否则它会把 3 个半径夹回近景。
  if (!prefersReducedMotion()) {
    controls.maxDistance = INTRO_MAX_DISTANCE
    cameraRig.apply({ lat: 16, lng: 96, altitude: 2.0, pin: false })
  }

  resizeObserver = new ResizeObserver(resizeGlobe)
  resizeObserver.observe(globeContainer.value)

  // 标签的遮挡 / 翻面判定跟着渲染帧走，成本是 12 次点积，可以忽略。
  tick()

  // 开场要等贴图真的画出来再开始，否则"俯冲"发生在黑屏上。
  // 同时留一个兜底：贴图迟迟不来（或加载失败）也不能让光点永远不出现。
  let introStarted = false
  const beginIntroOnce = () => {
    if (introStarted) return
    introStarted = true
    startIntro()
  }
  globe.value.onGlobeReady(beginIntroOnce)
  window.setTimeout(beginIntroOnce, 5000)

  // 仅供开发期截图/标定使用；生产构建会被 tree-shake 掉。
  if (import.meta.env.DEV) {
    window.__marchRig = cameraRig
    window.__marchGlobe = globe.value
  }
})

onBeforeUnmount(() => {
  clearIntro()
  cancelAnimationFrame(frameHandle)
  frameHandle = 0

  cameraRig?.cancelFlight()
  cameraRig = null
  window.clearTimeout(rotationTimer)
  resizeObserver?.disconnect()
  resizeObserver = null

  labelRecords.length = 0
  activeId = null
  hoverSuspended = null

  if (globe.value) {
    globe.value.controls().dispose()
    globe.value._destructor()
    globe.value = null
  }
})
</script>

<template>
  <div class="horizon-frame" aria-label="长征路线低地轨道空间站视角">
    <div
      ref="globeContainer"
      class="earth-globe"
      aria-label="长征路线数字地球，显示瑞金、遵义等历史节点"
    ></div>
    <div class="orbital-readout" aria-hidden="true">
      <span class="readout-dot"></span>
      <span>LOW EARTH ORBIT / CN-ROUTE</span>
    </div>
  </div>
</template>

<style scoped>
.horizon-frame {
  position: relative;
  width: 100vw;
  height: 100vh;
  min-height: 360px;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(ellipse at 50% 77%, rgba(71, 102, 126, 0.3), transparent 49%),
    linear-gradient(180deg, #070b13 0%, #0c1520 58%, #16222c 100%);
}

.horizon-frame::before {
  position: absolute;
  z-index: 3;
  right: 0;
  bottom: 17%;
  left: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(196, 163, 90, 0.18) 18%,
    rgba(224, 189, 114, 0.78) 50%,
    rgba(196, 163, 90, 0.18) 82%,
    transparent 100%
  );
  box-shadow: 0 0 28px rgba(196, 163, 90, 0.42);
  content: '';
  pointer-events: none;
}

.horizon-frame::after {
  position: absolute;
  z-index: 4;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(7, 11, 19, 0.48), transparent 24%, transparent 70%, rgba(7, 11, 19, 0.5)),
    radial-gradient(ellipse at 50% 74%, transparent 38%, rgba(3, 6, 11, 0.52) 100%);
  content: '';
  pointer-events: none;
}

/* 画布本身严格覆盖全屏。 */
.earth-globe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: visible;
}

:deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.orbital-readout {
  position: absolute;
  z-index: 6;
  top: 28px;
  left: 34px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgba(243, 241, 230, 0.62);
  font: 10px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.14em;
  pointer-events: none;
}

.readout-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c4a35a;
  box-shadow: 0 0 12px #c4a35a;
}

/* ———————————————————— 标签 ———————————————————— */

:deep(.march-label-anchor) {
  position: relative;
  display: block;
  width: 0;
  height: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  opacity: 1;
  transition: opacity 0.35s cubic-bezier(0.25, 1, 0.5, 1);
}

/* 锚点是 0×0，用伪元素撑出 36px 的透明命中圆，
   用户不必精准点到 9px 的小圆点。 */
:deep(.march-label-anchor::before) {
  position: absolute;
  top: 0;
  left: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  content: '';
  transform: translate(-50%, -50%);
}

/* 转到球体背面：整块淡出，同时让出点击。 */
:deep(.march-label-anchor.is-far) {
  opacity: 0;
  pointer-events: none;
}

:deep(.march-label-anchor.is-far .march-label-card),
:deep(.march-label-anchor.is-far .march-label-node),
:deep(.march-label-anchor.is-far::before) {
  pointer-events: none;
}

:deep(.march-label-node) {
  position: absolute;
  top: 0;
  left: 0;
  width: 9px;
  height: 9px;
  border: 1px solid #f8df9c;
  border-radius: 50%;
  background: #c4a35a;
  box-shadow:
    0 0 0 3px rgba(196, 163, 90, 0.18),
    0 0 18px rgba(224, 189, 114, 0.95);
  transform: translate(-50%, -50%);
  transition:
    opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.45s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.45s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.45s cubic-bezier(0.25, 1, 0.5, 1);
}

/* 开场镜头还没停稳时，光点处于"未点亮"状态，也不接受点击。 */
:deep(.march-label-anchor.is-pending) {
  pointer-events: none;
}

:deep(.march-label-anchor.is-pending .march-label-node) {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.2);
}

/* 点亮的一瞬间：先胀开一圈光晕，再收回常态 —— 像有人在天上点了盏灯。 */
:deep(.march-label-anchor.is-revealed .march-label-node) {
  animation: march-node-bloom 900ms cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes march-node-bloom {
  0% {
    transform: translate(-50%, -50%) scale(2.2);
    box-shadow:
      0 0 0 0 rgba(243, 212, 140, 0.7),
      0 0 34px rgba(243, 212, 140, 0.95);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow:
      0 0 0 3px rgba(196, 163, 90, 0.18),
      0 0 18px rgba(224, 189, 114, 0.95);
  }
}

:deep(.march-label-beam) {
  position: absolute;
  top: 0;
  left: 0;
  width: 30px;
  height: 1px;
  background: linear-gradient(90deg, #f3d48c, rgba(196, 163, 90, 0.2));
  box-shadow: 0 0 8px rgba(224, 189, 114, 0.8);
  /* 默认收成一小段并隐藏，避免静止时每个点后面都拖一根毛刺。 */
  opacity: 0;
  transform: translate(var(--beam-shift, 3px), -50%) scaleX(0.35);
  transform-origin: left center;
  transition:
    opacity 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.45s cubic-bezier(0.25, 1, 0.5, 1);
}

/* 卡片默认隐藏：靠 --slide-x 做位移，和垂直居中互不打架。 */
:deep(.march-label-card) {
  --slide-x: -6px;

  position: absolute;
  top: 0;
  left: 30px;
  display: grid;
  min-width: 92px;
  padding: 7px 10px 8px;
  border: 1px solid rgba(224, 189, 114, 0.56);
  border-left: 2px solid #c4a35a;
  border-radius: 1px 5px 5px 1px;
  background:
    linear-gradient(135deg, rgba(46, 52, 56, 0.92), rgba(11, 18, 26, 0.86)),
    radial-gradient(circle at 0 0, rgba(224, 189, 114, 0.18), transparent 55%);
  box-shadow:
    8px 8px 0 rgba(5, 9, 14, 0.42),
    0 5px 18px rgba(0, 0, 0, 0.32),
    inset 0 1px rgba(255, 255, 255, 0.11);
  color: #f3f1e6;
  font-family: 'Microsoft YaHei', 'Noto Sans CJK SC', 'PingFang SC', sans-serif;
  text-align: left;
  text-wrap: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%) translateX(var(--slide-x));
  transition:
    opacity 0.3s cubic-bezier(0.25, 1, 0.5, 1) 0.12s,
    transform 0.45s cubic-bezier(0.25, 1, 0.5, 1) 0.12s,
    background 0.45s cubic-bezier(0.25, 1, 0.5, 1),
    border-color 0.45s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.45s cubic-bezier(0.25, 1, 0.5, 1);
}

:deep(.march-label-code) {
  color: #c4a35a;
  font: 8px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.12em;
}

:deep(.march-label-card strong) {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

:deep(.march-label-card small) {
  margin-top: 3px;
  color: rgba(243, 241, 230, 0.55);
  font: 9px/1.2 'Space Mono', ui-monospace, monospace;
}

/* 靠近屏幕右缘：卡片翻到左侧，引线同步反向。 */
:deep(.march-label-anchor.is-flipped .march-label-card) {
  --slide-x: 6px;

  right: 30px;
  left: auto;
  border-right: 2px solid #c4a35a;
  border-left: 1px solid rgba(224, 189, 114, 0.56);
  border-radius: 5px 1px 1px 5px;
  text-align: right;
}

:deep(.march-label-anchor.is-flipped .march-label-beam) {
  --beam-shift: -3px;

  left: -30px;
  background: linear-gradient(270deg, #f3d48c, rgba(196, 163, 90, 0.2));
  transform-origin: right center;
}

/* 悬停 / 键盘聚焦 / 选中：三种状态共用同一套展开样式。 */
:deep(.march-label-anchor:hover .march-label-beam),
:deep(.march-label-anchor:focus-visible .march-label-beam),
:deep(.march-label-anchor.is-active .march-label-beam) {
  opacity: 1;
  transform: translate(var(--beam-shift, 3px), -50%) scaleX(1);
}

:deep(.march-label-anchor:hover .march-label-card),
:deep(.march-label-anchor:focus-visible .march-label-card),
:deep(.march-label-anchor.is-active .march-label-card) {
  --slide-x: 0px;

  border-color: #f3d48c;
  background:
    linear-gradient(135deg, rgba(74, 61, 38, 0.96), rgba(17, 24, 29, 0.94)),
    radial-gradient(circle at 0 0, rgba(224, 189, 114, 0.26), transparent 55%);
  box-shadow:
    10px 10px 0 rgba(5, 9, 14, 0.46),
    0 7px 24px rgba(196, 163, 90, 0.2),
    inset 0 1px rgba(255, 255, 255, 0.15);
  opacity: 1;
  pointer-events: auto;
  transition-delay: 0s;
}

/* 点亮过的站点：光点常亮一层暖金，和"还没点亮"的点拉开差别。 */
:deep(.march-label-anchor.is-lit .march-label-node) {
  background: #f6dc9c;
  box-shadow:
    0 0 0 1px rgba(246, 220, 156, 0.45),
    0 0 14px 3px rgba(224, 189, 114, 0.55);
}

:deep(.march-label-anchor.is-active .march-label-node) {
  background: #f3d48c;
  border-color: #fff6d8;
  box-shadow:
    0 0 0 5px rgba(196, 163, 90, 0.2),
    0 0 26px rgba(243, 212, 140, 0.95);
  transform: translate(-50%, -50%) scale(1.28);
}

@media (max-width: 768px) {
  .orbital-readout {
    top: 20px;
    left: 20px;
    font-size: 8px;
  }

  :deep(.march-label-card) {
    min-width: 76px;
    padding: 5px 7px 6px;
    left: 18px;
  }

  :deep(.march-label-card strong) {
    font-size: 12px;
  }

  :deep(.march-label-beam) {
    width: 18px;
  }

  :deep(.march-label-anchor.is-flipped .march-label-card) {
    right: 18px;
  }

  :deep(.march-label-anchor.is-flipped .march-label-beam) {
    left: -18px;
    width: 18px;
  }
}
</style>
