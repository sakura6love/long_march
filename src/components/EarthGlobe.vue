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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Globe from 'globe.gl'
import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
} from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import longMarchNodes from '../data.js'
import { createCameraRig, FRAME } from '../lib/cameraRig.js'
import { createRouteLine } from '../lib/routeLine.js'
import { STORY_EVENTS } from '../lib/story.js'
import { dbg } from '../lib/debug.js'

/* 事件标落在线上：用与火焰同一套时间轴（App.stationTimeOfAt）换算站点序号。 */
const eventMarks = STORY_EVENTS.map((e) => {
  const whole = Math.min(longMarchNodes.length - 1, Math.max(0, Math.floor(e.at)))
  const next = Math.min(longMarchNodes.length - 1, whole + 1)
  const f = Math.max(0, Math.min(1, e.at - Math.floor(e.at)))
  const a = longMarchNodes[whole]
  const b = longMarchNodes[next]
  return {
    kind: 'event',
    id: e.id,
    name: e.title,
    at: e.at,
    lat: a.lat + (b.lat - a.lat) * f,
    lng: a.lng + (b.lng - a.lng) * f,
  }
})
const labelItems = [...longMarchNodes.map((n) => ({ ...n, kind: 'node' })), ...eventMarks]

const props = defineProps({
  litIds: { type: Array, default: () => [] },
  /** 阅读面板展开时暂停 GPU 绘制，保留地图与路线状态。 */
  visible: { type: Boolean, default: true },
  reduced: { type: Boolean, default: false },
  /** 播放进度：已点亮的段数（0~11）。播放时用它，自由浏览时用 litIds。 */
  /** 事件背景图，垫在画布下方。 */
  backdrop: { type: String, default: '' },
  /** 只有落在俯瞰态时才显示「双击复位」 */
  showHint: { type: Boolean, default: false },
  /** 抬头（标题）只在俯瞰态显示，序章有自己的版式 */
  chrome: { type: Boolean, default: true },
  finale: { type: Boolean, default: false },
  /** 事件卡展示时，窄屏上把站点小卡收起来，避免压字 */
  labelsMuted: { type: Boolean, default: false },
  /** 播放中锁住双击复位，避免和燃烧抢动作 */
  locked: { type: Boolean, default: false },
  /** 0..1：地面烧到哪 */
  burn: { type: Number, default: 0 },
  /** 播放事件时把星球压暗成剪影 */
  dim: { type: Boolean, default: false },
  /** 事件标是否可见（只在俯瞰态、且没开事件卡时） */
  showEvents: { type: Boolean, default: true },
  labelsOn: { type: Boolean, default: true },
  /** 终章显示真实国界金线 */
  borderOn: { type: Boolean, default: false },
  /** 下一站 id：它的光点会呼吸闪烁 */
  nextId: { type: String, default: '' },
})

const _glowQ = new URLSearchParams(location.search).get('glow')
const _glowOverride = _glowQ === null || _glowQ === '' || Number.isNaN(Number(_glowQ)) ? null : Number(_glowQ)
const glowStyle = computed(() => {
  const raw = _glowOverride === null ? Math.max(0, Math.min(1, props.burn)) : Math.max(0, Math.min(1, _glowOverride))
  const v = Math.pow(raw, 0.75)
  return { '--glow': String(v) }
})

const emit = defineEmits(['select', 'select-event', 'tap', 'reset', 'ready', 'error'])

// 只让 DOM 容器参与 Vue 响应式；WebGL 实例使用 shallowRef，避免深度代理。
const globeContainer = ref(null)
const globe = shallowRef(null)

// 相机机位：三个旋钮（altitude / pitch / viewOffset）全部收口在 lib/cameraRig.js。
let cameraRig = null

// 路线火线：余烬虚线 + 已点燃的亮橙光带，几何挂在 globe.scene() 下。
let routeLine = null

// 序章是否已经把镜头俯冲下来了
let introStarted = false

// —— 渲染循环共享的普通变量，绝不进入响应式系统 ——
let resizeObserver = null
let frameHandle = 0
let disposed = false
let failed = false
let textureReady = false
let burnUniforms = null
let burnEffectsLoading = false
const ownedTextures = new Set()
const borderAbort = new AbortController()
let borderLoading = false
let webglCanvas = null

function reportError(code, message) {
  if (disposed || failed) return
  failed = true
  cancelAnimationFrame(frameHandle)
  frameHandle = 0
  globe.value?.pauseAnimation?.()
  routeLine?.pauseAnimation?.()
  emit('error', { code, message })
}

function handleContextLost(event) {
  event.preventDefault()
  reportError('webgl-context-lost', '地图显示中断，请切换到路线列表继续浏览。')
}

function moveCamera(next) {
  if (!cameraRig) return
  if (prefersReducedMotion()) cameraRig.apply(next)
  else cameraRig.flyTo(next)
}

function syncRendering() {
  if (!globe.value || failed || disposed) return
  const on = props.visible && !document.hidden
  if (on) {
    resizeGlobe()
    globe.value.resumeAnimation()
    routeLine?.resumeAnimation?.()
    if (!frameHandle) tick()
  } else {
    globe.value.pauseAnimation()
    routeLine?.pauseAnimation?.()
    cameraRig?.cancelFlight()
    cancelAnimationFrame(frameHandle)
    frameHandle = 0
  }
}
watch(() => props.visible, syncRendering)
watch(() => props.reduced, (reduced) => {
  if (reduced) {
    clearIntro()
    revealAll()
    if (cameraRig) cameraRig.apply(cameraRig.state)
  }
})

// 当前选中的节点 id：它的卡片会保持展开。
let activeId = null
// 悬停到别的节点时，被临时收起的"选中卡片"；指针移开即还原。
let hoverSuspended = null

// 标签 DOM ↔ 经纬度的对照表，供逐帧判定遮挡与左右翻转。
const labelRecords = []
const eventRecords = []
let headPinEl = null

// 卡片翻面的安全边距：卡片宽度 + 视口留白，超出就翻到左侧。
const FLIP_SAFE_MARGIN = 168

function resizeGlobe() {
  if (!globe.value || !globeContainer.value) return

  const { clientWidth, clientHeight } = globeContainer.value
  if (clientWidth > 0 && clientHeight > 0) {
    globe.value.width(clientWidth).height(clientHeight)
    cameraRig?.reframe()
    routeLine?.resize(clientWidth, clientHeight)
    borderGroup?.children.forEach((line) => line.material.resolution.set(clientWidth, clientHeight))
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
let burnValue = 0
watch(
  () => props.burn,
  (v) => {
    burnValue = v
    if (burnUniforms) burnUniforms.uBurn.value = v
    if (v > 0 && textureReady) ensureBurnEffects()
  },
  { immediate: true },
)

watch(
  () => props.litIds,
  (ids) => {
    const next = new Set(ids || [])
    // 新点亮的站：补一个 0.8s 的"点燃"动画（只跑一次，不常驻）
    for (const id of next) {
      if (!litIdSet.has(id)) igniteLabel(id)
    }
    litIdSet = next
    const indices = (ids || [])
      .map((id) => longMarchNodes.findIndex((n) => n.id === id))
      .filter((i) => i >= 0)
    routeLine?.setLit(indices)
  },
  { immediate: true, deep: true },
)

/** 一次性的点燃动画：光点弹一下 + 一圈金环扩散。 */
function igniteLabel(id) {
  if (prefersReducedMotion()) return
  const record = labelRecords.find((r) => r.id === id)
  if (!record) return
  const el = record.el
  el.classList.remove('is-igniting')
  void el.offsetWidth
  el.classList.add('is-igniting')
  window.setTimeout(() => el.classList.remove('is-igniting'), 900)
}

function updateHeadPin(burnS) {
  const el = headPinEl
  if (!el || !globe.value || !routeLine) return
  // 位置直接取火线采样的经纬度，与线严格同源（不要用站点直线插值）
  const head = routeLine.headLatLng
  if (!head) return
  const lat = head.lat
  const lng = head.lng
  const p = globe.value.getScreenCoords(lat, lng, 0.0015)
  const facing = isFacingCamera(lat, lng)
  const on = burnS > 0.0005 && facing && !!props.showEvents
  el.style.opacity = on ? '1' : '0'
  el.style.visibility = on ? 'visible' : 'hidden'
  if (p) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`
}

function updateEventStates() {
  if (!globe.value || eventRecords.length === 0) return
  if (!props.labelsOn || !props.showEvents) {
    for (const record of eventRecords) {
      record.el.classList.add('is-unreached')
      record.el.classList.remove('is-reached', 'is-hot')
    }
    return
  }
  const st = routeLine?.stationS || []
  if (!st.length) return
  // 统一用 routeLine 自己的进度（已按站点弧长归一化），
  // 不要混用 props.burn —— 那是 chainEnd/11 的另一套刻度。
  let burnS = routeLine?.headS ?? 0
  if (burnS <= 0.0001) {
    let maxIdx = -1
    for (let i = 0; i < longMarchNodes.length; i += 1) {
      if (litIdSet.has(longMarchNodes[i].id)) maxIdx = i
    }
    if (maxIdx >= 0) burnS = st[maxIdx]
  }
  for (const record of eventRecords) {
    const whole = Math.min(st.length - 1, Math.max(0, Math.floor(record.at)))
    const frac = Math.max(0, Math.min(1, record.at - whole))
    const a = st[whole]
    const b = st[Math.min(st.length - 1, whole + 1)]
    const s = a + (b - a) * frac
    const reached = burnS >= s - 0.002
    const hot = reached && burnS - s < 0.05
    record.el.classList.toggle('is-unreached', !reached)
    record.el.classList.toggle('is-reached', reached)
    record.el.classList.toggle('is-hot', hot)
  }
}

function updateLabelStates() {
  updateEventStates()
  if (!globe.value || labelRecords.length === 0) return

  const width = globe.value.width()
  const flipLine = width - FLIP_SAFE_MARGIN

  for (const record of labelRecords) {
    const facing = isFacingCamera(record.lat, record.lng)
    record.el.classList.toggle('is-far', !facing)
    // 点亮过的站点，光点常亮一层金晕
    record.el.classList.toggle('is-lit', litIdSet.has(record.id))
    record.el.classList.toggle('is-next', !!props.nextId && record.id === props.nextId)

    if (!facing) continue

    const screen = globe.value.getScreenCoords(record.lat, record.lng, 0.01)
    if (screen) {
      record.el.classList.toggle('is-flipped', screen.x > flipLine)
    }
  }
}

function tick() {
  frameHandle = 0
  if (!props.visible || document.hidden || failed || disposed) return
  frameHandle = requestAnimationFrame(tick)
  // 位移被库内部清掉时立刻补回，保证"点恒在 30% 那条线上"。
  cameraRig?.ensureOffset()
  updateLabelStates()
  // 火线头部光点必须每帧无条件更新：它曾挂在 updateEventStates 的末尾，
  // 而那个函数在 labelsOn=false 时会提前 return，导致光点冻结在上一帧、残留在图上。
  updateHeadPin(props.burn)

  // 事件场景：星球缓缓退到剪影，让背景影像浮出来。
  const dimTarget = props.dim ? 1 : 0
  if (Math.abs(dimLevel - dimTarget) > 0.001) {
    dimLevel += (dimTarget - dimLevel) * 0.14
    const k = 1 - 0.93 * dimLevel
    if (hemiLight) hemiLight.intensity = 0.95 * k
    if (ambientLight) ambientLight.intensity = 0.55 * k
    if (terrainLight) terrainLight.intensity = 1.35 * k
    if (rimLight) rimLight.intensity = 0.18 * k
  }
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
function focusNode(pointData, options = {}) {
  if (!globe.value) return

  // 用户在开场动画途中点了光点：立刻收掉剩余节奏，别让"点亮"追着镜头跑。
  clearIntro()
  revealAll()

  // 播放模式下不弹小卡片：此刻由事件卡承担叙事，卡片会挡住画面中心。
  if (!options.silent) setActive(pointData.id)

  // 统一机位：飞行 1.6s，落点固定在屏高 30% 的"主角线"上。
  // 不再用 pointOfView —— 它只管中心，管不了"点落在哪条线上"。
  moveCamera({
    lat: pointData.lat,
    lng: pointData.lng,
    altitude: cameraRig.state.altitude,
    duration: FRAME.flightMs,
  })

  if (!options.silent) emit('select', pointData)
}

function handleNodeSelect(pointData) {
  focusNode(pointData)
}

/** 默认俯瞰位：中国中部（33°N / 108°E）。开场落点与双击复位都用它。 */
const DEFAULT_VIEW = { lat: 33, lng: 108 }
// 竖屏时把首屏对准路线中心，让瑞金(116E)与会宁(105E)同时进画
const PORTRAIT_VIEW = { lat: 31.3, lng: 110.4 }
function defaultView() {
  const w = globe.value?.width?.() ?? 0
  const h = globe.value?.height?.() ?? 0
  return w && h && w / h < 0.85 ? PORTRAIT_VIEW : DEFAULT_VIEW
}

const hintVisible = ref(false)

// —— 事件背景层：两张图交替淡入，切换照片时不会黑一下 ——
const backdropOn = ref(false)
const bgA = ref('')
const bgB = ref('')
const activeLayer = ref(0)
const imgA = ref(null)
const imgB = ref(null)
let backdropUrl = ''

watch(
  () => props.backdrop,
  async (url) => {
    if (!url) {
      backdropOn.value = false
      return
    }
    if (url === backdropUrl) return
    backdropUrl = url
    const next = activeLayer.value === 0 ? 1 : 0
    // 先把新图写进「当前不可见」的那一层，等它解码完成再切 opacity。
    // 否则 <img> 会继续绘制上一轮的旧位图，出现"闪过前一张图"。
    if (next === 0) bgA.value = url
    else bgB.value = url
    backdropOn.value = true
    await nextTick()
    const el = next === 0 ? imgA.value : imgB.value
    if (el && typeof el.decode === 'function') {
      try {
        await el.decode()
      } catch (e) {
        /* 解码失败就直接切，至少不会卡住 */
      }
    }
    if (backdropUrl !== url) return
    activeLayer.value = next
  },
)

watch(
  () => props.labelsOn,
  (on) => {
    if (!on && headPinEl) {
      headPinEl.style.opacity = '0'
      headPinEl.style.visibility = 'hidden'
    }
  },
)

// —— 事件态竖屏构图：地球缩小、地平线下沉，给背景图让出上方空间 ——
watch(
  () => props.backdrop,
  (url) => {
    const w = globe.value?.width?.() || window.innerWidth || 0
    const h = globe.value?.height?.() || window.innerHeight || 0
    if (!w || !h || w / h >= 0.85) return
    moveCamera({
      lat: defaultView().lat,
      lng: defaultView().lng,
      altitude: url ? 0.98 : 0.46,
      aim: url ? 24 : 16,
      duration: 1200,
    })
  },
)

// —— 事件播放时把星球压暗成剪影 ——
let hemiLight = null
let ambientLight = null
let terrainLight = null
let rimLight = null
let dimLevel = 0

function resetView() {
  if (props.locked) return
  if (!globe.value) return

  clearIntro()
  revealAll()
  setActive(null)

  moveCamera({
    lat: defaultView().lat,
    lng: defaultView().lng,
    altitude: FRAME.altitude,
    duration: FRAME.flightMs,
  })

  emit('reset')
}

/**
 * 双击复位。
 * 双击落在光点标签上时不算 —— 那是"选中"而不是"回到俯瞰"。
 */
function handleDoubleClick(event) {
  if (event.target?.closest?.('.march-label-anchor')) return
  resetView()
}

// 面板上的"上一站 / 下一站"从外部调用它。
defineExpose({
  focusNode,
  /** 序章 → 俯瞰：镜头俯冲 + 光点依次点亮 */
  enterOverview() {
    routeLine?.setVisible(true)
    routeLine?.setLit(
      props.litIds
        .map((id) => longMarchNodes.findIndex((n) => n.id === id))
        .filter((i) => i >= 0),
    )
    if (introStarted) {
      moveCamera({
        lat: DEFAULT_VIEW.lat,
        lng: DEFAULT_VIEW.lng,
        altitude: FRAME.altitude,
        aim: FRAME.aim,
        duration: 1800,
      })
      return
    }
    introStarted = true
    startIntro()
  },
  /** 终章：镜头拉远，让整个中国进入画面 */
  pullBack() {
    hintVisible.value = false
    moveCamera({
      lat: DEFAULT_VIEW.lat,
      lng: DEFAULT_VIEW.lng,
      altitude: 0.62,
      aim: 10,
      duration: 2200,
    })
  },
  /** 回序章：镜头退回远景 */
  leaveOverview() {
    routeLine?.setVisible(false)
    clearIntro()
    hintVisible.value = false
    moveCamera({ lat: 16, lng: 96, altitude: 2.0, aim: 0, duration: 1600 })
  },
  ignite: (from, to, handlers) => {
    ensureBurnEffects()
    return routeLine?.ignite(from, to, handlers)
  },
  skipFire: () => routeLine?.skip(),
  resumeFire: () => routeLine?.resume(),
  clearFire: () => {
    routeLine?.clear()
    routeLine?.setVisible(false)
  },
  get stationS() {
    return routeLine?.stationS ?? []
  },
})

/* 拖动旋转：OrbitControls 已关闭输入，这里按屏幕位移直接改经纬度。
   灵敏度 0.22°/px，横向拖 → 地球跟着手指走。 */
let dragging = false
let lastPointer = { x: 0, y: 0 }

let pointerTravel = 0

function handlePointerDown(event) {
  if (event.target?.closest?.('.march-label-anchor')) return
  if (!cameraRig || event.button > 0) return
  dragging = true
  pointerTravel = 0
  lastPointer = { x: event.clientX, y: event.clientY }
}

function handlePointerMove(event) {
  if (!dragging || !cameraRig) return
  const dx = event.clientX - lastPointer.x
  const dy = event.clientY - lastPointer.y
  pointerTravel += Math.abs(dx) + Math.abs(dy)
  lastPointer = { x: event.clientX, y: event.clientY }
  cameraRig.orbitBy(-dx * 0.22, dy * 0.22)
}

function handlePointerUp() {
  // 拖拽不算点击：位移超过 6px 就当用户在转地球。
  if (dragging && pointerTravel < 6) emit('tap')
  dragging = false
}

/** 滚轮变焦：只改视高，不改构图。 */
function handleWheel(event) {
  if (!cameraRig) return
  cameraRig.zoomBy(event.deltaY * 0.0009)
}

/**
 * 外层元素严格保持 0x0。
 * CSS2DRenderer 会把零尺寸元素的原点投影到经纬度位置，
 * 圆点、引线和卡片全部从该原点展开，因此不会被卡片宽度拉偏。
 */
function createChineseLabel(pointData) {
  if (pointData.kind === 'event') return createEventMark(pointData)

  const anchor = document.createElement('button')
  anchor.type = 'button'
  anchor.className = 'march-label-anchor is-pending'
  anchor.dataset.nodeId = pointData.id
  anchor.setAttribute('aria-label', `查看${pointData.name}历史节点`)
  anchor.innerHTML = `
    <span class="march-label-beam" aria-hidden="true"></span>
    <svg class="march-label-node" viewBox="0 0 24 32" aria-hidden="true"><path class="ember-shape" d="M12 2 C14 8 18 10 19.5 14 C21 18 20.5 22 19 25 C17 29.5 14.5 31 12 31 C9.5 31 5.5 29 4 24 C2.8 19.5 4.5 16 6.5 13 C8.5 10 10 8 12 2 Z"/></svg>
    <span class="march-label-card"><strong>${pointData.name}</strong></span>
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

/** 开场动画的定时器，卸载或用户提前点击时统一清空。 */
let introTimers = []

function prefersReducedMotion() {
  return props.reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
  // 光点全部出现后，底部那行「双击复位」才淡入 —— 开场时先别干扰画面。
  hintVisible.value = true
}

/**
 * 事件标：落在路线上的菱形，位置由站点经纬度按 at 的小数部分插值。
 * 与站点标共用同一套投影（htmlElementsData），所以一定贴在线上。
 */
/**
 * 把事件点重新贴到火线上：at → 弧长（站点弧长插值）→ 曲线采样点。
 * 整数 at 再往前退 0.35 站，避免与站点圆点重叠。
 */
let borderGroup = null

async function loadCountryBorder(base) {
  if (borderLoading || borderGroup || disposed) return
  borderLoading = true
  try {
    const res = await fetch(`${base}geo/china-border.json`, { signal: borderAbort.signal })
    if (!res.ok) return
    const data = await res.json()
    const rings = (Array.isArray(data?.rings) ? data.rings : []).filter(
      (r) => Array.isArray(r) && r.length > 3,
    )
    if (!rings.length || !globe.value || disposed) return

    const group = new Group()
    const res2 = new Vector2(globe.value.width(), globe.value.height())
    for (const ring of rings) {
      const pts = []
      for (const [lng, lat] of ring) {
        const c = globe.value.getCoords(lat, lng, 0.006)
        pts.push(c.x, c.y, c.z)
      }
      if (pts.length < 9) continue
      const g = new LineGeometry()
      g.setPositions(pts)
      const m = new LineMaterial({
        color: 0xb9a27e,
        linewidth: 1.5,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      })
      m.resolution.copy(res2)
      const line = new Line2(g, m)
      line.computeLineDistances()
      group.add(line)
    }
    group.visible = props.borderOn
    borderGroup = group
    globe.value.scene().add(group)
  } catch (e) {
    // 缺数据时静默降级
  }
}

function applyBorder() {
  if (borderGroup) borderGroup.visible = props.borderOn
  else if (props.borderOn && globe.value) loadCountryBorder(import.meta.env.BASE_URL)
}

watch(() => props.borderOn, applyBorder)

function syncEventPositions() {
  const st = routeLine?.stationS
  if (!st || st.length < 2) return
  let changed = false
  for (const e of eventMarks) {
    const at = e.at ?? 0
    const whole = Math.min(st.length - 1, Math.max(0, Math.floor(at)))
    const next = Math.min(st.length - 1, whole + 1)
    const frac = Math.max(0, Math.min(1, at - Math.floor(at)))
    let arc = st[whole] + (st[next] - st[whole]) * frac
    if (frac === 0 && whole > 0) arc -= (st[whole] - st[whole - 1]) * 0.35
    const ll = routeLine.latLngAtS(Math.max(0, arc))
    if (!ll) continue
    if (Math.abs(ll.lat - e.lat) > 1e-6 || Math.abs(ll.lng - e.lng) > 1e-6) {
      e.lat = ll.lat
      e.lng = ll.lng
      changed = true
    }
  }
  if (changed) {
    eventRecords.length = 0
    globe.value?.htmlElementsData(labelItems)
  }
}

function createEventMark(pointData) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'march-event-anchor is-unreached'
  el.dataset.eventId = pointData.id
  el.setAttribute('aria-label', `查看事件：${pointData.name}`)
  el.innerHTML =
    '<span class="march-event-diamond" aria-hidden="true"></span>' +
    `<i class="march-event-tip">${pointData.name}</i>`
  el.addEventListener('click', (event) => {
    event.stopPropagation()
    if (!props.labelsOn) return
    emit('select-event', pointData.id)
  })
  eventRecords.push({ el, id: pointData.id, at: pointData.at, lat: pointData.lat, lng: pointData.lng })
  return el
}

/**
 * 开场编排：先从"整球"起步（altitude 2.45，球缘弧线正好压在画面上沿），
 * 再俯冲到 altitude 0.72，最后让 12 个光点按时间顺序依次点亮。
 * 用户随时可以拖动或点击，提前点击会立刻中断后续节奏。
 */
function startIntro() {
  if (prefersReducedMotion()) {
    cameraRig.apply({ lat: DEFAULT_VIEW.lat, lng: DEFAULT_VIEW.lng, altitude: FRAME.altitude })
    revealAll()
    return
  }

  // 相机在 mount 时已经退到整球（见 onMounted），这里只等一拍再俯冲。
  introTimers.push(
    window.setTimeout(() => {
      moveCamera({
        lat: DEFAULT_VIEW.lat,
        lng: DEFAULT_VIEW.lng,
        altitude: FRAME.altitude,
        aim: FRAME.aim,
        duration: 2000,
      })

      introTimers.push(
        window.setTimeout(() => {
          labelRecords.forEach((record, index) => {
            introTimers.push(
              window.setTimeout(() => {
                record.el.classList.remove('is-pending')
                record.el.classList.add('is-revealed')
              }, index * 80),
            )
          })

          // 最后一个光点亮完之后，再让「双击复位」淡入。
          introTimers.push(
            window.setTimeout(() => {
              hintVisible.value = true
            }, labelRecords.length * 80 + 400),
          )
        }, 2100),
      )
    }, 600),
  )
}

/**
 * 贴图放大倍数太大是"糊"的第一主因：4096 宽的图在 1080p 下已经被放大 1.74 倍。
 * 各向异性过滤是第二主因 —— three-globe 从不设置它，默认值 1 会让斜视区域
 * （尤其是球缘）强制降 mipmap。这里把两项都拉到硬件上限。
 */
function sharpenGlobeTexture() {
  const g = globe.value
  if (!g) return

  const renderer = g.renderer?.()
  const maxAniso = Math.min(4, renderer?.capabilities?.getMaxAnisotropy?.() || 1)
  const material = g.globeMaterial()

  if (material.map) {
    material.map.anisotropy = maxAniso
    material.map.minFilter = LinearMipmapLinearFilter
    material.map.magFilter = LinearFilter
    material.map.needsUpdate = true
  }
  if (material.normalMap) {
    material.normalMap.anisotropy = maxAniso
    material.normalMap.needsUpdate = true
  }
  if (material.specularMap) {
    material.specularMap.anisotropy = maxAniso
    material.specularMap.needsUpdate = true
  }
  material.needsUpdate = true
}

async function ensureBurnEffects() {
  if (!textureReady || !globe.value || burnUniforms || burnEffectsLoading || prefersReducedMotion()) return
  burnEffectsLoading = true
  try {
// —— 地区燃烧：三张烘焙图 + 四个 uniform ——
const bakeBase = `${import.meta.env.BASE_URL}bake/`
const bakeLoader = new TextureLoader()
const results = await Promise.allSettled(['ignition.png', 'china.png', 'crust.png'].map((name) => bakeLoader.loadAsync(`${bakeBase}${name}`)))
const loaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
if (disposed || !globe.value || loaded.length !== 3) {
  loaded.forEach((texture) => texture.dispose())
  return
}
const [ignTex, cnTex, crustTex] = loaded
loaded.forEach((texture) => ownedTextures.add(texture))
const globeMaterial = globe.value.globeMaterial()
burnUniforms = {
  uIgnition: { value: ignTex },
  uChina: { value: cnTex },
  uCrust: { value: crustTex },
  uBurn: { value: burnValue },
}
globeMaterial.defines = Object.assign({}, globeMaterial.defines, { USE_UV: '' })
globeMaterial.needsUpdate = true
globeMaterial.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, burnUniforms)
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
uniform sampler2D uIgnition;
uniform sampler2D uChina;
uniform sampler2D uCrust;
uniform float uBurn;`,
    )
    .replace(
      '#include <dithering_fragment>',
      `{
  float tIgn = texture2D(uIgnition, vUv).r;
  float inCn = smoothstep(0.12, 0.82, texture2D(uChina, vUv).r);
  float jitter = (texture2D(uCrust, vUv * 2.3).r - 0.5) * 0.07;
  float burnActive = smoothstep(0.0, 0.06, uBurn);
  // 已点亮：越靠近路线越早、越亮
  float lit = (1.0 - smoothstep(uBurn - 0.16 + jitter, uBurn + 0.03 + jitter, tIgn)) * inCn * burnActive;
  // 终章：全国一起亮
  float full = smoothstep(0.86, 0.98, uBurn) * inCn;
  lit = max(lit, full * 0.85);
  // 波前：一圈亮金边，燃烧是"推过去"的，不是"整块变"
  float distToFront = abs(tIgn - uBurn + jitter);
  float ring = (1.0 - smoothstep(0.0, 0.05, distToFront)) * smoothstep(0.35, 0.9, texture2D(uChina, vUv).r) * burnActive;
  // 细密金点，像万家灯火
  float grain = smoothstep(0.55, 1.0, texture2D(uCrust, vUv * 26.0).r);
  vec3 gold = vec3(1.0, 0.78, 0.42);

  // 重生：不是烧黑，而是点亮 —— 保留地表纹理，整体提亮并偏暖
  vec3 litCol = gl_FragColor.rgb * (1.0 + 0.16 * lit + 0.26 * full) * mix(vec3(1.0), gold, 0.22 * full + 0.14 * lit) + gold * 0.05 * full;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, litCol, clamp(lit * 0.46 + full * 0.40, 0.0, 0.74));
  // 点亮后与境外拉开：国境之外整体压暗
  gl_FragColor.rgb *= mix(1.0, 0.72, full * (1.0 - inCn));

  gl_FragColor.rgb += gold * ring * 0.35;
  gl_FragColor.rgb += vec3(1.0, 0.86, 0.62) * grain * lit * 0.18;
  gl_FragColor.rgb += gold * (1.0 - smoothstep(0.0, 0.12, tIgn)) * lit * 0.06;
}
#include <dithering_fragment>`,
    )
}
dbg('__marchBurn', burnUniforms)
  } catch {
    // 装饰性的点亮贴图失败时保留可读的地形、节点与路线。
  }
}

onMounted(async () => {
  if (!globeContainer.value) return

  // 贴图放在 public 里随包发布：比赛现场断网也能立刻出图，
  // 不再等 unpkg 的 1.4MB（首屏黑屏两秒会毁掉开场）。
  const assetBase = import.meta.env.BASE_URL
  try {
    globe.value = Globe({ animateIn: false, rendererConfig: { antialias: true, alpha: true, powerPreference: 'low-power' } })(globeContainer.value)
      .backgroundColor('rgba(0, 0, 0, 0)')
      .showAtmosphere(false)
      // 保持原有所有节点的经纬度与标签高度不变。
      .htmlElementsData(labelItems)
      .htmlLat((point) => point.lat)
      .htmlLng((point) => point.lng)
      .htmlAltitude(0.0015)
      .htmlTransitionDuration(0)
      .htmlElement(createChineseLabel)
      // 自定义相机不会触发 OrbitControls 的 POV 更新；背面遮挡由
      // updateLabelStates 每帧负责，避免库以旧相机位置隐藏全部 DOM 标记。
      .htmlElementVisibilityModifier(() => {})

    globe.value.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    webglCanvas = globe.value.renderer().domElement
    webglCanvas.addEventListener('webglcontextlost', handleContextLost)

    // 坐标自检：DOM 锚点中心 vs 同一经纬度的投影点，误差应 < 1.5px
    dbg('__geoCheck', () => {
      const g = globe.value
      const all = [
        ...labelRecords.map((r) => ({ ...r, kind: 'node' })),
        ...eventRecords.map((r) => ({ ...r, kind: 'event' })),
      ]
      return all
        .filter((r) => r.el && r.el.isConnected)
        .map((r) => {
          const p = g.getScreenCoords(r.lat, r.lng, 0.0015)
          const rect = r.el.getBoundingClientRect()
          return {
            kind: r.kind,
            id: r.id,
            dx: +(rect.left - p.x).toFixed(2),
            dy: +(rect.top - p.y).toFixed(2),
          }
        })
    })

    headPinEl = document.createElement('div')
    headPinEl.className = 'march-head-pin'
    headPinEl.innerHTML = '<span class="march-head-dot"></span>'
    globeContainer.value?.appendChild(headPinEl)

    const scene = globe.value.scene()

    // 暖灰环境光保留山川纹理，与纸色档案面板一致。
    hemiLight = new HemisphereLight(0xe8dfcb, 0x595247, 0.95)
    ambientLight = new AmbientLight(0xe4ded0, 0.55)
    scene.add(hemiLight)
    scene.add(ambientLight)

    // 主光：仰角约 9°，从西南方斜切过来 —— 山体阴影被拉长，
    // 近景才有"摸得到"的起伏；再高就变成正午平光，地形立刻变平。
    terrainLight = new DirectionalLight(0xffeed6, 1.35)
    terrainLight.position.set(-180, 30, 125)
    scene.add(terrainLight)

    // 中性补光保留边界，不绘制蓝色大气光圈。
    rimLight = new DirectionalLight(0xbfb6a4, 0.18)
    rimLight.position.set(120, 18, -160)
    scene.add(rimLight)

    // 路线火线：先铺一条余烬虚线，点亮的段由 watch(litIds) 重建。
    routeLine = createRouteLine(globe.value, longMarchNodes, STORY_EVENTS)
    if (props.borderOn) loadCountryBorder(assetBase)
    syncEventPositions()
    dbg('__route', routeLine)
    dbg('__globe', globe.value)
    // 序章默认干净：火线、余烬、火焰先全部收起，进俯瞰时再打开
    routeLine.setVisible(false)
    routeLine.setLit(
      props.litIds.map((id) => longMarchNodes.findIndex((n) => n.id === id)).filter((i) => i >= 0),
    )

    const globeMaterial = globe.value.globeMaterial()

    // 仅载入一张分级主纹理；地形依靠底图细节和柔和侧光，不再预取法线/高光图。
    globeMaterial.specular.set(0x39372f)
    globeMaterial.shininess = 5
    globeMaterial.color.set('#c6bca3')
    globeMaterial.emissive.set('#302d25')
    globeMaterial.emissiveIntensity = 0.13
    globeMaterial.needsUpdate = true

    // 机位统一交给 cameraRig。
    cameraRig = createCameraRig(globe.value)

    // 新机位模型自己管相机：OrbitControls 只保留 target 同步，输入全部关闭，
    // 免得它和 placeCamera 抢相机的朝向。
    const controls = globe.value.controls()
    controls.enabled = false
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableRotate = false
    controls.enableDamping = false

    resizeGlobe()

    // 首帧就站在"整球"的位置：球缘弧线正好压在画面上沿 12% 处。
    if (!prefersReducedMotion()) {
      cameraRig.apply({ lat: 16, lng: 96, altitude: 2.0, aim: 0 })
    }

    resizeObserver = new ResizeObserver(resizeGlobe)
    resizeObserver.observe(globeContainer.value)

    // 标签的遮挡 / 翻面判定跟着渲染帧走，成本是 12 次点积，可以忽略。
    document.addEventListener('visibilitychange', syncRendering)
    window.addEventListener('resize', resizeGlobe)
    syncRendering()

    // 窄屏、节省流量及慢网选 2K；其他桌面选 4K。每次只请求其中一张。
    const connection = navigator.connection
    const compact = globeContainer.value.clientWidth <= 900 || connection?.saveData || /(^|-)2g$|3g/.test(connection?.effectiveType || '')
    const texture = await new TextureLoader().loadAsync(`${assetBase}earth-${compact ? '2k' : '4k'}.webp`)
    if (disposed || !globe.value || failed) {
      texture.dispose()
      return
    }
    ownedTextures.add(texture)
    texture.colorSpace = SRGBColorSpace
    globeMaterial.map = texture
    globeMaterial.needsUpdate = true
    sharpenGlobeTexture()
    textureReady = true
    if (props.burn > 0) ensureBurnEffects()
    emit('ready')

    // 仅供开发期截图/标定使用；生产构建会被 tree-shake 掉。
    if (import.meta.env.DEV) {
      dbg('__marchRig', cameraRig)
      dbg('__marchGlobe', globe.value)
    }
  } catch (error) {
    reportError('map-load-failed', '地图暂时无法载入，请使用路线列表继续浏览。')
  }
})

onBeforeUnmount(() => {
  disposed = true
  borderAbort.abort()
  webglCanvas?.removeEventListener('webglcontextlost', handleContextLost)
  document.removeEventListener('visibilitychange', syncRendering)
  window.removeEventListener('resize', resizeGlobe)
  headPinEl?.remove()
  headPinEl = null
  clearIntro()
  cancelAnimationFrame(frameHandle)
  frameHandle = 0

  cameraRig?.cancelFlight()
  cameraRig = null

  routeLine?.clear()
  routeLine?.dispose()
  routeLine = null
  resizeObserver?.disconnect()
  resizeObserver = null

  borderGroup?.children.forEach((line) => {
    line.geometry.dispose()
    line.material.dispose()
  })
  borderGroup = null
  ownedTextures.forEach((texture) => texture.dispose())
  ownedTextures.clear()
  labelRecords.length = 0
  eventRecords.length = 0
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
  <div
    class="horizon-frame"
    :style="glowStyle"
    :class="{ 'is-finale': finale, 'labels-muted': labelsMuted, 'labels-off': !labelsOn, 'is-reduced': reduced, 'is-paused': !visible }"
    aria-label="长征路线俯瞰地球，显示中国境内的十二个历史节点"
    @dblclick="handleDoubleClick"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
    @pointerleave="handlePointerUp"
    @wheel.prevent="handleWheel"
  >
    <div class="event-backdrop" :class="{ 'is-on': backdropOn }" aria-hidden="true">
      <img v-if="bgA" ref="imgA" class="event-backdrop-img" :class="{ 'is-shown': activeLayer === 0 }" :src="bgA" alt="" />
      <img v-if="bgB" ref="imgB" class="event-backdrop-img" :class="{ 'is-shown': activeLayer === 1 }" :src="bgB" alt="" />
    </div>
    <div
      ref="globeContainer"
      class="earth-globe"
      aria-label="长征路线数字地球，显示瑞金、遵义等历史节点"
    ></div>
    <Transition name="hint">
      <p v-if="hintVisible && showHint" class="overlook-hint" aria-hidden="true">双击复位</p>
    </Transition>
  </div>
</template>

<style scoped>
.horizon-frame {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  overflow: hidden;
  isolation: isolate;
  touch-action: none;
  cursor: grab;
  background: radial-gradient(ellipse at 50% 42%, #45473e 0%, #30332c 52%, #20231e 100%);
}
.horizon-frame:active { cursor: grabbing; }
.horizon-frame::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(24, 25, 21, .34), transparent 25%, transparent 66%, rgba(24, 25, 21, .7));
}
.earth-globe { position: absolute; inset: 0; overflow: visible; }
:deep(canvas) { display: block; width: 100%; height: 100%; }
.horizon-frame :deep(canvas) {
  filter: saturate(.28) sepia(.24) brightness(1.12) contrast(.96);
}
:deep(.scene-nav-info) { display: none !important; }
.event-backdrop { position: absolute; inset: 0; z-index: 0; overflow: hidden; opacity: 0; pointer-events: none; transition: opacity .6s ease; }
.event-backdrop.is-on { opacity: 1; }
.event-backdrop::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(27, 28, 23, .25), transparent 30%, rgba(27, 28, 23, .65)); }
.event-backdrop-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; filter: saturate(.6) brightness(.85); transition: opacity .7s ease; }
.event-backdrop-img.is-shown { opacity: 1; }
.overlook-hint { position: absolute; z-index: 6; left: 50%; bottom: 24px; transform: translateX(-50%); margin: 0; color: #e7dfcf; font: 13px/1.5 var(--font-body, sans-serif); letter-spacing: .06em; pointer-events: none; }
.hint-enter-active { transition: opacity .3s ease; }
.hint-enter-from { opacity: 0; }
:deep(.march-head-pin) { position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 12; pointer-events: none; opacity: 0; }
:deep(.march-head-dot) { position: absolute; left: -6px; top: -6px; width: 12px; height: 12px; border-radius: 50%; background: #a04432; border: 2px solid #f2dfb6; box-shadow: 0 0 0 5px rgba(185, 126, 82, .17); }
/* 经纬度锚点保持零尺寸，文字和点击区域从原点展开。 */
:deep(.march-label-anchor) { position: relative; display: block; width: 0; height: 0; padding: 0; border: 0; background: transparent; cursor: pointer; pointer-events: auto; opacity: 1; transition: opacity .25s ease; }
:deep(.march-label-anchor::before) { content: ''; position: absolute; width: 44px; height: 44px; left: 0; top: 0; border-radius: 50%; transform: translate(-50%, -50%); }
:deep(.march-label-anchor.is-far) { opacity: 0; visibility: hidden; pointer-events: none; }
:deep(.march-label-node) { position: absolute; left: 0; top: 0; width: 15px; height: 20px; overflow: visible; transform: translate(-50%, -50%); filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .65)); transition: transform .2s ease; }
:deep(.march-label-node .ember-shape) { fill: #4f5045; stroke: #ead5af; stroke-width: 1.8; stroke-linejoin: round; }
:deep(.march-label-anchor.is-lit .ember-shape) { fill: #af5038; stroke: #f2dfba; }
:deep(.march-label-anchor.is-active .march-label-node),
:deep(.march-label-anchor:focus-visible .march-label-node) { transform: translate(-50%, -50%) scale(1.4); filter: drop-shadow(0 0 5px rgba(242, 223, 186, .55)); }
:deep(.march-label-anchor.is-active .ember-shape) { fill: #c15d40; stroke: #fff0ce; }
:deep(.march-label-anchor:hover .march-label-node) { transform: translate(-50%, -50%) scale(1.2); }
:deep(.march-label-anchor.is-next .march-label-node) { animation: next-node 2.8s ease-in-out infinite; }
@keyframes next-node { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
:deep(.march-label-anchor.is-pending) { pointer-events: none; }
:deep(.march-label-anchor.is-pending .march-label-node) { opacity: 0; }
:deep(.march-label-anchor.is-revealed .march-label-node),
:deep(.march-label-anchor.is-igniting .march-label-node) { animation: node-reveal .5s ease-out; }
@keyframes node-reveal { from { opacity: .1; transform: translate(-50%, -50%) scale(.6); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
:deep(.march-label-beam) { position: absolute; top: 0; left: 0; width: 24px; height: 1px; background: #c4ac87; opacity: 0; transform: translateY(-50%); transition: opacity .2s ease; }
:deep(.march-label-card) { position: absolute; top: 0; left: 24px; min-width: 74px; padding: 9px 13px; background: rgba(35, 36, 30, .96); border: 1px solid #a89575; border-radius: 1px; color: #f4ecdc; font-family: var(--font-body, 'PingFang SC', 'Microsoft YaHei', sans-serif); text-align: left; white-space: nowrap; opacity: 0; pointer-events: none; transform: translateY(-50%); transition: opacity .18s ease; }
:deep(.march-label-card strong) { font-size: 15px; line-height: 1.4; font-weight: 500; letter-spacing: .04em; }
:deep(.march-label-anchor.is-flipped .march-label-card) { right: 24px; left: auto; }
:deep(.march-label-anchor.is-flipped .march-label-beam) { left: -24px; }
:deep(.march-label-anchor:hover .march-label-card),
:deep(.march-label-anchor:focus-visible .march-label-card),
:deep(.march-label-anchor.is-active .march-label-card),
:deep(.march-label-anchor:hover .march-label-beam),
:deep(.march-label-anchor:focus-visible .march-label-beam),
:deep(.march-label-anchor.is-active .march-label-beam) { opacity: 1; }
:deep(.march-label-anchor:focus-visible .march-label-card) { outline: 2px solid #f1dfbb; outline-offset: 3px; }
:deep(.march-event-anchor) { position: relative; width: 0; height: 0; padding: 0; border: 0; background: transparent; pointer-events: auto; cursor: pointer; }
:deep(.march-event-anchor::before) { content: ''; position: absolute; width: 36px; height: 36px; transform: translate(-50%, -50%); }
:deep(.march-event-diamond) { position: absolute; left: -3px; top: -3px; width: 6px; height: 6px; transform: rotate(45deg); background: #ac9674; border: 1px solid #e7d6b8; }
:deep(.march-event-anchor.is-hot .march-event-diamond) { background: #f1d6a3; transform: rotate(45deg) scale(1.2); }
:deep(.march-event-tip) { position: absolute; left: 12px; top: -18px; padding: 5px 9px; white-space: nowrap; font: normal 13px/1.5 var(--font-body, sans-serif); color: #f4ecdc; background: #282a23; border: 1px solid #a89575; opacity: 0; pointer-events: none; }
:deep(.march-event-anchor:hover .march-event-tip),
:deep(.march-event-anchor:focus-visible .march-event-tip) { opacity: 1; }
:deep(.march-event-anchor.is-unreached) { opacity: 0; visibility: hidden; pointer-events: none; }
.horizon-frame.labels-off :deep(.march-label-anchor),
.horizon-frame.labels-off :deep(.march-event-anchor) { opacity: 0 !important; visibility: hidden; pointer-events: none !important; }
.horizon-frame.is-paused :deep(*) { animation-play-state: paused !important; }
.horizon-frame.is-reduced :deep(*),
.horizon-frame.is-reduced .event-backdrop,
.horizon-frame.is-reduced .event-backdrop-img { animation: none !important; transition: none !important; }
@media (max-width: 768px) {
  .horizon-frame.labels-muted :deep(.march-label-card) { opacity: 0 !important; pointer-events: none; }
  :deep(.march-label-card) { min-width: 64px; padding: 7px 10px; }
  :deep(.march-label-card strong) { font-size: 14px; }
  .event-backdrop-img { object-position: 50% 30%; }
}
@media (prefers-reduced-motion: reduce) {
  .horizon-frame :deep(*), .event-backdrop, .event-backdrop-img { animation: none !important; transition: none !important; }
}
</style>
