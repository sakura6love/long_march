import { CatmullRomCurve3, Group, Vector2, Vector3 } from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { ROUTE_SEGMENTS } from './routePath.js'

export const ROUTE_LIFT = 0.0015

/** A geographically anchored route; hidden exhibits do not keep a second RAF alive. */
export function createRouteLine(globe, nodes) {
  const radius = globe.getGlobeRadius() * (1 + ROUTE_LIFT)
  const control = ROUTE_SEGMENTS.flat().map(({ lat, lng }) => {
    const p = globe.getCoords(lat, lng, 0)
    return new Vector3(p.x, p.y, p.z).normalize()
  })
  const curve = new CatmullRomCurve3(control, false, 'catmullrom', .5)
  const samples = curve.getPoints((control.length - 1) * 12).map(point => point.multiplyScalar(radius))
  const positions = samples.flatMap(point => [point.x, point.y, point.z])
  const coordinates = samples.map(point => globe.toGeoCoords(point))
  const distances = new Float32Array(samples.length)
  for (let i = 1; i < samples.length; i++) distances[i] = distances[i - 1] + samples[i].distanceTo(samples[i - 1])
  const length = distances[distances.length - 1] || 1
  for (let i = 0; i < distances.length; i++) distances[i] /= length
  const stationS = nodes.map(node => {
    let best = 0
    let distance = Infinity
    coordinates.forEach((point, i) => {
      const d = (point.lat - node.lat) ** 2 + ((point.lng - node.lng) * Math.cos(node.lat * Math.PI / 180)) ** 2
      if (d < distance) { best = i; distance = d }
    })
    return distances[best]
  })
  const group = new Group()
  group.name = 'march-route'
  globe.scene().add(group)
  const baseGeometry = new LineGeometry()
  const activeGeometry = new LineGeometry()
  baseGeometry.setPositions(positions)
  activeGeometry.setPositions(positions)
  const baseMaterial = new LineMaterial({ color: '#b69a66', linewidth: 1.3, transparent: true, opacity: .7, depthWrite: false })
  const activeMaterial = new LineMaterial({ color: '#d26950', linewidth: 3.2, transparent: true, depthWrite: false })
  const base = new Line2(baseGeometry, baseMaterial)
  const active = new Line2(activeGeometry, activeMaterial)
  base.frustumCulled = active.frustumCulled = false
  base.renderOrder = 3
  active.renderOrder = 4
  group.add(base, active)
  let head = 0
  let burn = null
  let raf = 0
  let lastTime = 0
  let animationPaused = false
  let disposed = false
  const resolution = new Vector2()

  function resize() {
    resolution.set(globe.width(), globe.height())
    baseMaterial.resolution.copy(resolution)
    activeMaterial.resolution.copy(resolution)
  }
  function indexAt(s) {
    let index = 0
    while (index + 1 < distances.length && distances[index + 1] <= s) index++
    return index
  }
  function progress(s) {
    head = Math.max(0, Math.min(1, s))
    const count = indexAt(head)
    activeGeometry.instanceCount = count
    active.visible = count > 0
  }
  function finish() {
    const done = burn?.handlers.onDone
    burn = null
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    done?.()
  }
  function arm() {
    if (disposed || animationPaused || !burn || burn.paused || raf) return
    lastTime = performance.now()
    raf = requestAnimationFrame(tick)
  }
  function tick(time) {
    raf = 0
    if (disposed || animationPaused || !burn || burn.paused) return
    const delta = Math.min(.05, (time - lastTime) / 1000)
    lastTime = time
    burn.s = Math.min(burn.end, burn.s + burn.speed * delta)
    const next = burn.events[0]
    if (next && burn.s >= next.s) {
      burn.s = next.s
      burn.events.shift()
      burn.paused = true
      progress(burn.s)
      burn.handlers.onEvent?.(next.event)
      return // The final event remains readable until the user continues.
    }
    progress(burn.s)
    if (burn.s >= burn.end) { finish(); return }
    raf = requestAnimationFrame(tick)
  }
  resize()
  progress(0)
  return {
    group,
    get stationS() { return stationS },
    get headS() { return head },
    get headLatLng() { return coordinates[indexAt(head)] },
    latLngAtS(s) { return coordinates[indexAt(s)] },
    setLit(indices) {
      if (burn) return
      const marked = new Set(indices)
      let end = 0
      while (marked.has(end)) end++
      progress(end > 0 ? stationS[end - 1] : 0)
    },
    ignite(from, to, handlers = {}) {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      burn = null
      const start = stationS[Math.max(0, Math.min(nodes.length - 1, from))]
      const end = stationS[Math.max(0, Math.min(nodes.length - 1, to))]
      if (end <= start) { progress(end); handlers.onDone?.(); return }
      const span = end - start
      burn = { s: start, end, speed: span / 2.2, paused: false, handlers,
        events: (handlers.events || []).filter(item => item.s > start && item.s <= end).sort((a, b) => a.s - b.s) }
      progress(start)
      arm()
    },
    skip() { if (burn) { progress(burn.end); finish() } },
    resume() { if (burn) { burn.paused = false; arm() } },
    pauseAnimation() { animationPaused = true; if (raf) cancelAnimationFrame(raf); raf = 0 },
    resumeAnimation() { animationPaused = false; arm() },
    clear() { burn = null; if (raf) cancelAnimationFrame(raf); raf = 0; progress(0) },
    setVisible(value) { group.visible = value },
    resize,
    dispose() {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      burn = null
      globe.scene().remove(group)
      baseGeometry.dispose(); activeGeometry.dispose(); baseMaterial.dispose(); activeMaterial.dispose()
    },
  }
}
