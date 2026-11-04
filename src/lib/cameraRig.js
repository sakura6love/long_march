/**
 * 相机机位（camera rig）—— 把"构图"拆成三个互不干扰的旋钮。
 *
 *   1. altitude      → 球多大（相机离地心多远）
 *   2. lookAt(pitch) → 相机站在目标点南侧几度，决定目标点在球面上的位置
 *   3. viewOffset    → 整幅画面上移/下移，把目标点精确顶到屏高 nodeY 那条线
 *
 * 三者分别调，不会出现"调了高度，光点就跑了"。
 * 位移只用 camera.setViewOffset（改投影矩阵，Canvas 与 CSS2D 一起动），
 * 绝不用 CSS transform 移容器 —— 那是"光点乱飞"的第一大根源。
 */

/** 默认构图参数：只改这一处，整站构图跟着走。 */
export const FRAME = {
  // 选中点落在屏高 30% 的"主角线"上
  nodeY: 0.3,
  // 相机站在目标点南侧 10°：斜视让山体阴影拉长，近景才有立体感
  pitch: 10,
  // 首屏视高（0.72 ≈ 距地心 1.72 个地球半径）
  altitude: 0.72,
  // 飞行时长（ms），与 CSS 的 1.6s 对齐
  flightMs: 1600,
}

/** 与 SKILL 一致的唯一缓动：cubic-bezier(0.25, 1, 0.5, 1)。 */
function cubicBezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x
  const bx = 3 * (p2x - p1x) - cx
  const ax = 1 - cx - bx
  const cy = 3 * p1y
  const by = 3 * (p2y - p1y) - cy
  const ay = 1 - cy - by

  const sampleX = (t) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t) => ((ay * t + by) * t + cy) * t
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx

  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1

    // 牛顿迭代反解 t，再取 y —— 与浏览器 cubic-bezier 的手感一致。
    let t = x
    for (let i = 0; i < 6; i += 1) {
      const dx = sampleDX(t)
      if (Math.abs(dx) < 1e-6) break
      t -= (sampleX(t) - x) / dx
    }
    return sampleY(t)
  }
}

const ease = cubicBezier(0.25, 1, 0.5, 1)

const lerp = (a, b, t) => a + (b - a) * t

export function createCameraRig(globe) {
  const camera = globe.camera()
  const controls = globe.controls()
  const state = { ...FRAME, lat: 35.6921, lng: 105.0533 }

  let flightHandle = 0
  let flight = null

  /** 目标点当前投在屏幕上的 y（px）。 */
  function measureY(lat, lng) {
    const point = globe.getScreenCoords(lat, lng, 0.01)
    return point ? point.y : globe.height() / 2
  }

  /** 把相机放到 (lat - pitch, lng) 方向、离地心 altitude 个半径处，始终看向地心。 */
  function placeCamera(lat, lng, altitude, pitch) {
    const point = globe.getCoords(lat - pitch, lng, altitude)
    camera.position.set(point.x, point.y, point.z)
    camera.lookAt(0, 0, 0)
    controls.target.set(0, 0, 0)
    // 关键：getScreenCoords 走 vec.project(camera)，用的是 matrixWorldInverse。
    // 手动改完相机姿态必须立刻刷新，否则量到的是上一帧的位置（会差出上百像素）。
    camera.updateMatrixWorld(true)
  }

  /** 最近一次生效的位移，供 ensureOffset 自愈时使用。 */
  let lastOffsetY = 0

  function setOffset(offsetY) {
    const width = globe.width()
    const height = globe.height()
    if (!width || !height) return
    lastOffsetY = offsetY
    camera.setViewOffset(width, height, 0, offsetY, width, height)
    camera.updateProjectionMatrix()
  }
  /** 在"当前相机位置"下，目标点要钉到 nodeY 所需的 offsetY。 */
  function solveOffsetY(lat, lng) {
    const height = globe.height()
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
    return measureY(lat, lng) - state.nodeY * height
  }

  function cancelFlight() {
    cancelAnimationFrame(flightHandle)
    flightHandle = 0
    flight = null
  }

  /**
   * 立即落位（无动画）。用于首屏、窗口 resize。
   */
  function apply(next = {}) {
    cancelFlight()
    Object.assign(state, next)

    if (!globe.width() || !globe.height()) return

    placeCamera(state.lat, state.lng, state.altitude, state.pitch)
    setOffset(solveOffsetY(state.lat, state.lng))
    controls.update()
  }

  /**
   * 统一飞行入口：所有"点一个光点 → 镜头过去"都必须走这里。
   * 飞行期间接管 controls，结束后再交还 —— 避免补间与 OrbitControls 打架。
   */
  function flyTo({ lat, lng, altitude = state.altitude, pitch = state.pitch, duration = state.flightMs } = {}) {
    cancelFlight()
    controls.enabled = false

    const from = {
      lat: state.lat,
      lng: state.lng,
      altitude: state.altitude,
      pitch: state.pitch,
      offsetY: camera.view ? camera.view.offsetY : 0,
    }

    // 先把终点算出来：落点的 offsetY 依赖终点的相机姿态，所以先"试放"一次。
    placeCamera(lat, lng, altitude, pitch)
    const toOffsetY = solveOffsetY(lat, lng)
    // 复位到起点，准备逐帧插值。
    placeCamera(from.lat, from.lng, from.altitude, from.pitch)
    setOffset(from.offsetY)

    // 经度走最短弧：避免从 179° 飞到 -179° 时绕地球一整圈。
    let deltaLng = lng - from.lng
    if (deltaLng > 180) deltaLng -= 360
    if (deltaLng < -180) deltaLng += 360

    flight = { from, to: { lat, lng, altitude, pitch, offsetY: toOffsetY }, deltaLng, startedAt: 0 }
    state.lat = lat
    state.lng = lng
    state.altitude = altitude
    state.pitch = pitch

    const step = (time) => {
      if (!flight) return
      if (!flight.startedAt) flight.startedAt = time

      const t = Math.min(1, (time - flight.startedAt) / duration)
      const k = ease(t)

      const latNow = lerp(flight.from.lat, flight.to.lat, k)
      const lngNow = flight.from.lng + flight.deltaLng * k
      const altitudeNow = lerp(flight.from.altitude, flight.to.altitude, k)
      const pitchNow = lerp(flight.from.pitch, flight.to.pitch, k)
      const offsetNow = lerp(flight.from.offsetY, flight.to.offsetY, k)

      placeCamera(latNow, lngNow, altitudeNow, pitchNow)
      setOffset(offsetNow)
      controls.update()

      if (t < 1) {
        flightHandle = requestAnimationFrame(step)
        return
      }

      // 落位误差兜底：终点再用测量值精确校正一次（浮点插值可能差 1~2px）。
      placeCamera(lat, lng, altitude, pitch)
      setOffset(toOffsetY)
      controls.update()

      flightHandle = 0
      flight = null
      controls.enabled = true
    }

    flightHandle = requestAnimationFrame(step)
  }

  /**
   * 自愈：three-render-objects 在初始化（以及它自己的 viewOffset 属性变化）时
   * 会调用一次 camera.clearViewOffset()，把我们设好的投影位移清掉 ——
   * 表现就是"首屏一切正常，刷新一下就整体上移 64px"。
   * 位移是我们唯一的构图旋钮，所以每帧确认它还活着，被清了就补回去。
   */
  function ensureOffset() {
    if (flight) return
    if (!camera.view || !camera.view.enabled || camera.view.offsetY !== lastOffsetY) {
      setOffset(lastOffsetY)
    }
  }

  /** 窗口尺寸变化：offsetY 是像素值，必须重算。 */
  function reframe() {
    if (flight) return
    if (!globe.width() || !globe.height()) return
    setOffset(solveOffsetY(state.lat, state.lng))
  }

  /** 当前镜头注视点是否就是某个坐标（调试用）。 */
  function isFocusedOn(lat, lng, tolerance = 0.01) {
    return Math.abs(state.lat - lat) < tolerance && Math.abs(state.lng - lng) < tolerance
  }

  return { state, apply, flyTo, reframe, ensureOffset, isFocusedOn, cancelFlight }
}

export default createCameraRig
