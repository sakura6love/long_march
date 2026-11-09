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
import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  LinearMipmapLinearFilter,
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
  /** 播放进度：已点亮的段数（0~11）。播放时用它，自由浏览时用 litIds。 */
  /** 事件背景图（垫在画布下方、星空层之上） */
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

const emit = defineEmits(['select', 'select-event', 'tap', 'reset'])

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
let rotationTimer = null
let frameHandle = 0

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
    if (import.meta.env.DEV && window.__marchBurn) window.__marchBurn.uBurn.value = v
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
  if (p) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`
}

function updateEventStates() {
  if (!globe.value || eventRecords.length === 0) return
  if (!props.labelsOn) {
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
  updateHeadPin(burnS)
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
  frameHandle = requestAnimationFrame(tick)
  // 位移被库内部清掉时立刻补回，保证"点恒在 30% 那条线上"。
  cameraRig?.ensureOffset()
  updateLabelStates()

  // 事件场景：星球缓缓退到剪影，让背景影像浮出来。
  const dimTarget = props.dim ? 1 : 0
  if (Math.abs(dimLevel - dimTarget) > 0.001) {
    dimLevel += (dimTarget - dimLevel) * 0.14
    const k = 1 - 0.93 * dimLevel
    if (hemiLight) hemiLight.intensity = 0.55 * k
    if (ambientLight) ambientLight.intensity = 0.12 * k
    if (terrainLight) terrainLight.intensity = 3.05 * k
    if (rimLight) rimLight.intensity = 0.26 * k
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
  cameraRig?.flyTo({
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
let backdropUrl = ''

watch(
  () => props.backdrop,
  (url) => {
    if (!url) {
      backdropOn.value = false
      return
    }
    if (url === backdropUrl) return
    backdropUrl = url
    const next = activeLayer.value === 0 ? 1 : 0
    if (next === 0) bgA.value = url
    else bgB.value = url
    activeLayer.value = next
    backdropOn.value = true
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

  cameraRig?.flyTo({
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
      cameraRig?.flyTo({
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
    cameraRig?.flyTo({
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
    cameraRig?.flyTo({ lat: 16, lng: 96, altitude: 2.0, aim: 0, duration: 1600 })
  },
  ignite: (from, to, handlers) => routeLine?.ignite(from, to, handlers),
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
    <span class="march-label-node" aria-hidden="true"></span>
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
  try {
    const res = await fetch(`${base}geo/china-border.json`)
    if (!res.ok) return
    const data = await res.json()
    const rings = (Array.isArray(data?.rings) ? data.rings : []).filter(
      (r) => Array.isArray(r) && r.length > 3,
    )
    if (!rings.length || !globe.value) return

    const group = new Group()
    const res2 = new Vector2(window.innerWidth, window.innerHeight)
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
        color: 0xffd88a,
        linewidth: 2.2,
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
      cameraRig.flyTo({
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
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 1
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

onMounted(() => {
  if (!globeContainer.value) return

  // 贴图放在 public 里随包发布：比赛现场断网也能立刻出图，
  // 不再等 unpkg 的 1.4MB（首屏黑屏两秒会毁掉开场）。
  const assetBase = import.meta.env.BASE_URL

  globe.value = Globe()(globeContainer.value)
    .backgroundColor('rgba(0, 0, 0, 0)')
    .globeImageUrl(`${assetBase}earth-8k.jpg`)
    .showAtmosphere(true)
    .atmosphereColor('#a8d4ff')
    .atmosphereAltitude(0.22)
    // 保持原有所有节点的经纬度与标签高度不变。
    .htmlElementsData(labelItems)
    .htmlLat((point) => point.lat)
    .htmlLng((point) => point.lng)
    .htmlAltitude(0.0015)
    .htmlTransitionDuration(0)
    .htmlElement(createChineseLabel)

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

  // 光照只有一个目的：把山脊刻出来，而不是把地球照亮。
  // 环境光偏暖、压得很低，保证背光那一侧仍是深蓝而不是死黑。
  // 天空/地面双色环境光：天空偏冷、地面偏暖，比纯环境光更有"大气"。
  hemiLight = new HemisphereLight(0x9fc4e8, 0x2b2418, 0.55)
  ambientLight = new AmbientLight(0x3a3a32, 0.12)
  scene.add(hemiLight)
  scene.add(ambientLight)

  // 主光：仰角约 9°，从西南方斜切过来 —— 山体阴影被拉长，
  // 近景才有"摸得到"的起伏；再高就变成正午平光，地形立刻变平。
  terrainLight = new DirectionalLight(0xffe6c0, 3.05)
  terrainLight.position.set(-180, 30, 125)
  scene.add(terrainLight)

  // 补光：极暗的冷色，只负责勾出右上方的球缘，避免边缘融进背景。
  rimLight = new DirectionalLight(0x5b7fa6, 0.26)
  rimLight.position.set(120, 18, -160)
  scene.add(rimLight)

  // 路线火线：先铺一条余烬虚线，点亮的段由 watch(litIds) 重建。
  routeLine = createRouteLine(globe.value, longMarchNodes, STORY_EVENTS)
  loadCountryBorder(assetBase)
  syncEventPositions()
  dbg('__route', routeLine)
  dbg('__globe', globe.value)
  // 序章默认干净：火线、余烬、火焰先全部收起，进俯瞰时再打开
  routeLine.setVisible(false)
  routeLine.setLit(
    props.litIds.map((id) => longMarchNodes.findIndex((n) => n.id === id)).filter((i) => i >= 0),
  )

  const globeMaterial = globe.value.globeMaterial()

  // 法线与高光贴图：让"山脊有起伏、海面有反光"。
  // 两张都是数据图，必须保持线性色彩空间（不要设 SRGBColorSpace）。
  const maxAniso = globe.value.renderer().capabilities.getMaxAnisotropy()
  const textureLoader = new TextureLoader()
  const normalTexture = textureLoader.load(`${assetBase}earth-normal.png`)
  const specularTexture = textureLoader.load(`${assetBase}earth-specular.png`)
  normalTexture.anisotropy = maxAniso
  specularTexture.anisotropy = maxAniso

  globeMaterial.normalMap = normalTexture
  globeMaterial.normalScale.set(2.2, 2.2)
  globeMaterial.specularMap = specularTexture
  // 海面高光压成冷灰蓝：纯白会立刻变"湿塑料"。
  globeMaterial.specular.set(0x3a4d60)
  globeMaterial.shininess = 70
  // 微暖的基色乘上去，把贴图里过饱和的蓝绿压回 UI 的暖灰调子。
  globeMaterial.color.set('#f7f1e4')
  globeMaterial.roughness = 0.9
  globeMaterial.metalness = 0.02
  globeMaterial.emissive.set('#121821')
  globeMaterial.emissiveIntensity = 0.05
  globeMaterial.needsUpdate = true

// —— 地区燃烧：三张烘焙图 + 四个 uniform ——
const bakeBase = `${import.meta.env.BASE_URL}bake/`
const bakeLoader = new TextureLoader()
const ignTex = bakeLoader.load(`${bakeBase}ignition.png`)
const cnTex = bakeLoader.load(`${bakeBase}china.png`)
const crustTex = bakeLoader.load(`${bakeBase}crust.png`)
const burnUniforms = {
  uIgnition: { value: ignTex },
  uChina: { value: cnTex },
  uCrust: { value: crustTex },
  uBurn: { value: 0 },
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
  // 先给 OrbitControls 放宽距离上限，否则它会把 3 个半径夹回近景。
  if (!prefersReducedMotion()) {
    cameraRig.apply({ lat: 16, lng: 96, altitude: 2.0, aim: 0 })
  }

  resizeObserver = new ResizeObserver(resizeGlobe)
  resizeObserver.observe(globeContainer.value)

  // 标签的遮挡 / 翻面判定跟着渲染帧走，成本是 12 次点积，可以忽略。
  tick()

  // 开场要等贴图真的画出来再开始，否则"俯冲"发生在黑屏上。
  // 同时留一个兜底：贴图迟迟不来（或加载失败）也不能让光点永远不出现。
  // 序章阶段先停在远景（整球缓转），由 App 调 enterOverview() 再俯冲。
  globe.value.onGlobeReady(() => {
    sharpenGlobeTexture()
  })

  // 仅供开发期截图/标定使用；生产构建会被 tree-shake 掉。
  if (import.meta.env.DEV) {
    dbg('__marchRig', cameraRig)
    dbg('__marchGlobe', globe.value)
  }
})

onBeforeUnmount(() => {
  clearIntro()
  cancelAnimationFrame(frameHandle)
  frameHandle = 0

  cameraRig?.cancelFlight()
  cameraRig = null

  routeLine?.dispose()
  routeLine = null
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
  <div
    class="horizon-frame"
    :class="{ 'is-finale': finale, 'labels-muted': labelsMuted, 'labels-off': !labelsOn }"
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
      <img class="event-backdrop-img" :class="{ 'is-shown': activeLayer === 0 }" :src="bgA" alt="" />
      <img class="event-backdrop-img" :class="{ 'is-shown': activeLayer === 1 }" :src="bgB" alt="" />
    </div>
    <div
      ref="globeContainer"
      class="earth-globe"
      aria-label="长征路线数字地球，显示瑞金、遵义等历史节点"
    ></div>
    <header v-if="chrome" class="masthead">
      <p class="masthead-kicker" aria-hidden="true">
        <span class="readout-dot"></span>
        LOW EARTH ORBIT / CN-ROUTE
      </p>
      <h1 class="masthead-title">长征万里 · 薪火千秋</h1>
      <p class="masthead-sub">1934—1936 · 十二个坐标，一条改变中国的路</p>
    </header>

    <Transition name="hint">
      <p v-if="hintVisible && showHint" class="overlook-hint" aria-hidden="true">双击复位</p>
    </Transition>
  </div>
</template>

<style scoped>
.horizon-frame {
  transition: transform 2.2s cubic-bezier(0.25, 1, 0.5, 1);
  transform-origin: 50% 46%;
  position: relative;
  width: 100vw;
  height: 100vh;
  min-height: 360px;
  overflow: hidden;
  isolation: isolate;
  touch-action: none;
  background:
    radial-gradient(ellipse at 50% 46%, rgba(58, 96, 130, 0.22), transparent 58%),
    linear-gradient(180deg, #03060b 0%, #050a12 48%, #0a1622 100%);
}

/* 星空单独一层：垫在渐变之上、画布之下，画布透明的地方能透出来。 */
@media (max-width: 768px) {
  .horizon-frame.labels-muted :deep(.march-label-card) {
    opacity: 0 !important;
    pointer-events: none;
  }
}

.horizon-frame.is-finale {
  transform: scale(0.86);
}

.horizon-frame::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  background: url('/stars.png') center / cover no-repeat;
  opacity: 0.85;
  content: '';
  pointer-events: none;
}

.horizon-frame::after {
  position: absolute;
  z-index: 4;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(7, 11, 19, 0.52), transparent 22%, transparent 52%, rgba(7, 11, 19, 0.82) 100%),
    radial-gradient(ellipse at 50% 30%, transparent 30%, rgba(3, 6, 11, 0.6) 100%);
  content: '';
  pointer-events: none;
}

/* globe.gl 会往容器里塞一个自带的操作提示条（.scene-nav-info），
   那是库的预制 UI，和整体设计不搭，直接藏掉。 */
:deep(.scene-nav-info) {
  display: none !important;
}

/* 事件背景：垫在画布下方、星空上方；只在事件播放时显形。 */
.event-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.9s ease;
}

.event-backdrop.is-on {
  opacity: 1;
}

.event-backdrop::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(3, 6, 11, 0.2) 0%, rgba(3, 6, 11, 0) 38%, rgba(3, 6, 11, 0.72) 100%);
  content: '';
}

.event-backdrop-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.06);
  filter: blur(11px) saturate(0.78) brightness(0.62);
  transition: opacity 1.1s ease;
}

.event-backdrop-img.is-shown {
  opacity: 0.95;
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

.masthead {
  position: absolute;
  z-index: 6;
  top: 26px;
  left: 34px;
  max-width: 46vw;
  pointer-events: none;
}

.masthead-kicker {
  display: flex;
  margin: 0 0 12px;
  align-items: center;
  gap: 9px;
  color: rgba(243, 241, 230, 0.5);
  font: 10px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.14em;
}

/* 标题是"抬头看得到、低头不抢戏"的存在感：小字号 + 宋体 + 大量字距。 */
.masthead-title {
  margin: 0;
  color: rgba(243, 241, 230, 0.9);
  font-family: 'Songti SC', 'Noto Serif SC', 'STSong', serif;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0.3em;
  line-height: 1.4;
  text-shadow: 0 1px 18px rgba(4, 7, 12, 0.75);
}

.overlook-hint {
  display: none; /* 已并入 App 的 story-hint，避免底部堆三行 */
  position: fixed;
  z-index: 6;
  bottom: 22px;
  left: 50%;
  margin: 0;
  transform: translateX(-50%);
  color: rgba(243, 241, 230, 0.26);
  font-family: 'Songti SC', 'Noto Serif SC', 'STSong', serif;
  font-size: 11px;
  letter-spacing: 0.24em;
  pointer-events: none;
  white-space: nowrap;
}

.hint-enter-active {
  transition: opacity 1.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.hint-enter-from {
  opacity: 0;
}

.masthead-sub {
  margin: 10px 0 0;
  color: rgba(243, 241, 230, 0.34);
  font-size: 11px;
  letter-spacing: 0.16em;
}

.readout-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-gold);
  box-shadow: 0 0 12px var(--accent-gold);
}

/* ———————————————————— 标签 ———————————————————— */


:deep(.march-head-pin) {
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  z-index: 12;
  pointer-events: none;
  opacity: 0;
  transition: opacity 260ms ease;
  will-change: transform;
}

:deep(.march-head-dot) {
  position: absolute;
  left: -5px;
  top: -5px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #8c2a17;
  border: 1.5px solid #e8c98a;
  box-shadow: 0 0 10px rgba(200, 70, 40, 0.75), 0 0 22px rgba(140, 42, 23, 0.45);
}

:deep(.march-event-anchor) {
  position: relative;
  width: 20px;
  height: 20px;
  z-index: 30;
  padding: 0;
  border: 0;
  background: none;
  pointer-events: auto;
  cursor: pointer;
}

:deep(.march-event-diamond) {
  position: absolute;
  left: 13px;
  top: 7px;
  width: 5px;
  height: 5px;
  transform: rotate(45deg);
  background: rgba(212, 175, 55, 0.22);
  border: 1px solid rgba(232, 201, 138, 0.75);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  transition: transform 300ms var(--ease), background 260ms, box-shadow 260ms;
}


:deep(.march-event-tip) {
  position: absolute;
  left: 16px;
  top: -18px;
  padding: 2px 6px;
  white-space: nowrap;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: rgba(243, 241, 230, 0.92);
  background: rgba(8, 12, 18, 0.86);
  border: 1px solid rgba(212, 175, 55, 0.35);
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
}

:deep(.march-event-anchor:hover .march-event-tip) {
  opacity: 1;
  transform: translateY(0);
}

:deep(.march-event-anchor.is-unreached) {
  opacity: 0;
  pointer-events: none;
}

:deep(.march-event-anchor.is-reached .march-event-diamond) {
  background: var(--accent-gold);
  border-color: #ffeec4;
}

:deep(.march-event-anchor.is-hot .march-event-diamond) {
  background: #ffe6b0;
  border-color: #fff6d6;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 0 10px rgba(243, 212, 140, 0.85);
  transform: rotate(45deg) scale(1.25);
}

:deep(.march-event-anchor:hover .march-event-diamond) {
  background: #ffd88a;
  transform: rotate(45deg) scale(1.35);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 0 10px rgba(232, 201, 138, 0.7);
}

.horizon-frame.labels-off :deep(.march-label-anchor),
.horizon-frame.labels-off :deep(.march-event-anchor) {
  opacity: 0 !important;
  visibility: hidden;
  pointer-events: none !important;
}

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
  border: 1px solid rgba(212, 175, 55, 0.7);
  border-radius: 1px;
  background: transparent;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55);
  transform: translate(-50%, -50%);
  transition:
    opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.45s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.45s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.45s cubic-bezier(0.25, 1, 0.5, 1);
}

/* 开场镜头还没停稳时，光点处于"未点亮"状态，也不接受点击。 */
:deep(.march-label-anchor.is-lit .march-label-node) {
  width: 8px;
  height: 8px;
  border-color: #f8df9c;
  background: var(--accent-red);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    0 0 0 3px rgba(138, 21, 56, 0.3),
    0 0 12px rgba(138, 21, 56, 0.55);
}

/* 下一站：只有这一颗在呼吸，其余保持安静 */
:deep(.march-label-anchor.is-next .march-label-node) {
  animation: node-breathe 2.6s var(--ease) infinite;
}

@keyframes node-breathe {
  0%, 100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.38); }
  50% { box-shadow: 0 0 0 7px rgba(212, 175, 55, 0); }
}

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
      0 0 0 3px rgba(212, 175, 55, 0.18),
      0 0 18px rgba(224, 189, 114, 0.95);
  }
}

:deep(.march-label-beam) {
  position: absolute;
  top: 0;
  left: 0;
  width: 30px;
  height: 1px;
  background: linear-gradient(90deg, #f8df9c, rgba(212, 175, 55, 0.2));
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
  border-left: 2px solid var(--accent-gold);
  border-radius: 1px 5px 5px 1px;
  background:
    linear-gradient(135deg, rgba(46, 52, 56, 0.92), rgba(11, 18, 26, 0.86)),
    radial-gradient(circle at 0 0, rgba(224, 189, 114, 0.18), transparent 55%);
  box-shadow:
    8px 8px 0 rgba(5, 9, 14, 0.42),
    0 5px 18px rgba(0, 0, 0, 0.32),
    inset 0 1px rgba(255, 255, 255, 0.11);
  color: var(--text-main);
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
  color: var(--accent-gold);
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
  border-right: 2px solid var(--accent-gold);
  border-left: 1px solid rgba(224, 189, 114, 0.56);
  border-radius: 5px 1px 1px 5px;
  text-align: right;
}

:deep(.march-label-anchor.is-flipped .march-label-beam) {
  --beam-shift: -3px;

  left: -30px;
  background: linear-gradient(270deg, #f8df9c, rgba(212, 175, 55, 0.2));
  transform-origin: right center;
}

/* 悬停 / 键盘聚焦 / 选中：三种状态共用同一套展开样式。 */
:deep(.march-label-anchor:hover .march-label-beam),
:deep(.march-label-anchor:focus-visible .march-label-beam) {
  opacity: 1;
  transform: translate(var(--beam-shift, 3px), -50%) scaleX(1);
}

:deep(.march-label-anchor:hover .march-label-card),
:deep(.march-label-anchor:focus-visible .march-label-card) {
  --slide-x: 0px;

  border-color: #f8df9c;
  background:
    linear-gradient(135deg, rgba(74, 61, 38, 0.96), rgba(17, 24, 29, 0.94)),
    radial-gradient(circle at 0 0, rgba(224, 189, 114, 0.26), transparent 55%);
  box-shadow:
    10px 10px 0 rgba(5, 9, 14, 0.46),
    0 7px 24px rgba(212, 175, 55, 0.2),
    inset 0 1px rgba(255, 255, 255, 0.15);
  opacity: 1;
  pointer-events: auto;
  transition-delay: 0.18s, 0.18s, 0s, 0s, 0s;
}

/* 点亮过的站点：光点常亮一层暖金，和"还没点亮"的点拉开差别。 */
:deep(.march-label-anchor.is-next .march-label-node) {
  animation: march-next-pulse 1.7s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

/* 行军标记：由 3D 旗帜承担，标签这里不再插旗 */

@keyframes march-next-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(246, 220, 156, 0.45),
      0 0 12px 2px rgba(224, 189, 114, 0.5);
  }
  50% {
    box-shadow:
      0 0 0 5px rgba(243, 212, 140, 0.22),
      0 0 22px 6px rgba(243, 212, 140, 0.75);
  }
}

:deep(.march-label-anchor.is-lit .march-label-node) {
  background: #f6dc9c;
  box-shadow:
    0 0 0 1px rgba(246, 220, 156, 0.45),
    0 0 14px 3px rgba(224, 189, 114, 0.55);
}

/* 刚被点亮的瞬间：光点弹一下、金环炸开一次，然后回到常亮态。 */
:deep(.march-label-anchor.is-igniting .march-label-node) {
  animation: node-ignite 900ms cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes node-ignite {
  0% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow:
      0 0 0 0 rgba(255, 226, 180, 0.85),
      0 0 18px rgba(255, 150, 80, 0.5);
  }
  30% {
    transform: translate(-50%, -50%) scale(2.1);
    box-shadow:
      0 0 0 13px rgba(255, 226, 180, 0),
      0 0 30px rgba(255, 150, 80, 0.95);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow:
      0 0 0 0 rgba(255, 226, 180, 0),
      0 0 14px 3px rgba(224, 189, 114, 0.55);
  }
}

:deep(.march-label-anchor.is-active .march-label-node) {
  background: #f8df9c;
  border-color: #fff6d8;
  box-shadow:
    0 0 0 5px rgba(212, 175, 55, 0.2),
    0 0 26px rgba(243, 212, 140, 0.95);
  transform: translate(-50%, -50%) scale(1.28);
}

@media (max-width: 768px) {
  /* 手机屏窄，地球铺满整屏：顶部压暗一层，标题才压得住画面。 */
  /* 星空单独一层：垫在渐变之上、画布之下，画布透明的地方能透出来。 */
.horizon-frame::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  background: url('/stars.png') center / cover no-repeat;
  opacity: 0.85;
  content: '';
  pointer-events: none;
}

.horizon-frame::after {
    background:
      linear-gradient(180deg, rgba(7, 11, 19, 0.78), transparent 26%, transparent 68%, rgba(7, 11, 19, 0.6)),
      radial-gradient(ellipse at 50% 74%, transparent 34%, rgba(3, 6, 11, 0.5) 100%);
  }

  .masthead {
    top: 18px;
    left: 18px;
    max-width: 72vw;
  }

  .masthead-kicker {
    margin-bottom: 8px;
    font-size: 8px;
  }

  .masthead-title {
    font-size: 15px;
    letter-spacing: 0.24em;
  }

  .overlook-hint {
  display: none; /* 已并入 App 的 story-hint，避免底部堆三行 */
  position: fixed;
  z-index: 6;
  bottom: 22px;
  left: 50%;
  margin: 0;
  transform: translateX(-50%);
  color: rgba(243, 241, 230, 0.26);
  font-family: 'Songti SC', 'Noto Serif SC', 'STSong', serif;
  font-size: 11px;
  letter-spacing: 0.24em;
  pointer-events: none;
  white-space: nowrap;
}

.hint-enter-active {
  transition: opacity 1.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.hint-enter-from {
  opacity: 0;
}

.masthead-sub {
    margin-top: 6px;
    font-size: 9.5px;
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

/* 选中/点燃的站点：收掉标签电自带的柔光，火焰与火线才是唯一光源 */
.march-label-anchor.is-active,
.march-label-anchor.is-lit,
.march-label-anchor.is-igniting,
.march-label-anchor.is-active > *,
.march-label-anchor.is-lit > *,
.march-label-anchor.is-igniting > * {
  box-shadow: none !important;
}

/* 俯瞰态整体可拖：给一个明确的手型 */
.horizon-frame { cursor: grab; }
.horizon-frame:active { cursor: grabbing; }
</style>
