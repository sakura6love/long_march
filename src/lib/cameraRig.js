/**
 * 相机机位（camera rig）—— 低轨视角。
 *
 * 模型只有三个旋钮：
 *
 *   1. lat / lng    → 镜头"看向"地表上的哪一点（点击光点后就是那个点）
 *   2. altitude     → 相机离地心多远（越小越贴地、地平线越近）
 *   3. aim          → 相机站在目标点南侧几度（0 = 正俯视；越大越"平视"，
 *                     地球的弧形地平线就越往画面中间压）
 *
 * 相机永远 lookAt 目标点本身，所以目标点恒在屏幕正中；
 * 地平线出现在它上方、由 aim 决定的弧度处。这样"点一个光点 → 它到画面中央、
 * 地平线仍在原地"是几何自洽的，不需要再拿投影位移去凑。
 */

/** 默认构图：只改这一处，整站构图跟着走。 */
export const FRAME = {
  // 视高 0.28（距地心 1.28 个地球半径）≈ 1800 km，天宫空间站轨道量级
  altitude: 0.28,
  // 相机站在目标点南侧 16°，画面里能看见弧形地平线
  aim: 16,
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
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

export function createCameraRig(globe) {
  const camera = globe.camera()
  const controls = globe.controls()
  const state = { ...FRAME, lat: 33, lng: 108 }

  let flightHandle = 0
  let flight = null

  /**
   * 相机放到 (lat - aim, lng) 方向、离地心 altitude 个半径处，看向 (lat, lng)。
   * aim = 0 时退化为"正上方俯视地心"，用于开场整球。
   */
  /** 要装下的目标半径（km）：长征路线东西向半宽约 950km。 */
  const FIT_RADIUS_KM = 1020

  /**
   * 竖屏的水平视角只有约 23°（桌面约 80°），固定 altitude 会只看到中部。
   * 这里按「目标半径 / tan(hfov/2)」反推所需视高，作为 altitude 的下限；
   * 横屏（aspect ≥ 0.85）返回 0，不改变原有构图。
   */
  function fitAltitude() {
    const w = globe.width() || window.innerWidth || 0
    const h = globe.height() || window.innerHeight || 0
    if (!w || !h) return 0
    const aspect = w / h
    if (aspect >= 0.85) return 0
    const hfov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * aspect)
    const alt = FIT_RADIUS_KM / Math.tan(hfov / 2) / 6371
    return Math.min(1.25, alt)
  }

  function placeCamera(lat, lng, altitude, aim) {
    const eye = globe.getCoords(lat - aim, lng, Math.max(altitude, fitAltitude()))
    const target = globe.getCoords(lat, lng, 0.002)
    camera.position.set(eye.x, eye.y, eye.z)
    camera.lookAt(target.x, target.y, target.z)
    controls.target.set(target.x, target.y, target.z)
    // getScreenCoords 走 project(camera)，用 matrixWorldInverse；不刷新会量到上一帧。
    camera.updateMatrixWorld(true)
  }

  function cancelFlight() {
    cancelAnimationFrame(flightHandle)
    flightHandle = 0
    flight = null
  }

  /** 立即落位（无动画）。 */
  function apply(next = {}) {
    cancelFlight()
    Object.assign(state, next)
    if (!globe.width() || !globe.height()) return
    placeCamera(state.lat, state.lng, state.altitude, state.aim)
  }

  /** 统一飞行入口：所有"点一个光点 → 镜头过去"都必须走这里。 */
  function flyTo({ lat, lng, altitude = state.altitude, aim = state.aim, duration = state.flightMs } = {}) {
    cancelFlight()

    const from = { lat: state.lat, lng: state.lng, altitude: state.altitude, aim: state.aim }

    // 经度走最短弧：避免从 179° 飞到 -179° 时绕地球一整圈。
    let deltaLng = lng - from.lng
    if (deltaLng > 180) deltaLng -= 360
    if (deltaLng < -180) deltaLng += 360

    state.lat = lat
    state.lng = lng
    state.altitude = altitude
    state.aim = aim
    flight = { from, to: { lat, lng, altitude, aim }, deltaLng, startedAt: 0 }

    const step = (time) => {
      if (!flight) return
      if (!flight.startedAt) flight.startedAt = time

      const t = Math.min(1, (time - flight.startedAt) / duration)
      const k = ease(t)

      placeCamera(
        lerp(flight.from.lat, flight.to.lat, k),
        flight.from.lng + flight.deltaLng * k,
        lerp(flight.from.altitude, flight.to.altitude, k),
        lerp(flight.from.aim, flight.to.aim, k),
      )

      if (t < 1) {
        flightHandle = requestAnimationFrame(step)
        return
      }

      placeCamera(lat, lng, altitude, aim)
      flightHandle = 0
      flight = null
    }

    flightHandle = requestAnimationFrame(step)
  }

  /** 拖动旋转：按屏幕位移改经纬度，绕地心转 —— 与普通地球仪手感一致。 */
  function orbitBy(deltaLng, deltaLat) {
    if (flight) return
    state.lng = ((state.lng + deltaLng + 540) % 360) - 180
    state.lat = clamp(state.lat + deltaLat, -65, 65)
    placeCamera(state.lat, state.lng, state.altitude, state.aim)
  }

  /** 滚轮变焦：只动 altitude，构图（aim）不变。 */
  function zoomBy(delta) {
    if (flight) return
    state.altitude = clamp(state.altitude * (1 + delta), 0.12, 0.9)
    placeCamera(state.lat, state.lng, state.altitude, state.aim)
  }

  /**
   * 自愈：three-render-objects 初始化时会 clearViewOffset()。
   * 新模型不再用投影位移，但仍然每帧确认 offset 是干净的，
   * 否则残留的位移会把整幅画面顶偏。
   */
  function ensureOffset() {
    if (flight) return
    if (camera.view && camera.view.enabled) {
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }

  /** 窗口尺寸变化：重新落位即可（不再有像素单位的位移）。 */
  function reframe() {
    if (flight) return
    if (!globe.width() || !globe.height()) return
    placeCamera(state.lat, state.lng, state.altitude, state.aim)
  }

  function isFocusedOn(lat, lng, tolerance = 0.01) {
    return Math.abs(state.lat - lat) < tolerance && Math.abs(state.lng - lng) < tolerance
  }

  return { state, apply, flyTo, reframe, ensureOffset, isFocusedOn, cancelFlight, orbitBy, zoomBy }
}

export default createCameraRig
