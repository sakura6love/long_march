/**
 * 长征路线火线 —— 一条线，从瑞金烧到会宁。
 *
 * 这一版重写了三件事：
 *  1) 全线只有一条几何（Line2 + instanceCount 控制"烧到哪儿"），段间不可能再断；
 *  2) 曲线用 Catmull-Rom 穿过真实途经点，不再是折线硬拐；
 *  3) 贴地高度与光点完全一致（R × 1.0015），侧视不会再"浮起来"。
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { ROUTE_SEGMENTS } from './routePath.js'

/** 与 EarthGlobe 的 htmlAltitude 保持一致 —— 线贴地，光点也贴地。 */
export const ROUTE_LIFT = 0.0015

const SAMPLES_PER_CTRL = 10
const HEAD_SPAN = 0.022 // 火头渐变长度（占全线弧长的比例）
const COOL_SECONDS = 1.1 // 烧过之后多久变成暗红
const ASH = new Color('#7a1a12')
const EMBER = new Color('#8b1c1c')


/** 柔和的圆点贴图：Points 默认画方块，必须给贴图才像火星。 */
function makeDotTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 226, 190, 1)')
  g.addColorStop(0.35, 'rgba(214, 92, 60, 0.75)')
  g.addColorStop(1, 'rgba(120, 24, 16, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

export function createRouteLine(globe, nodes) {
  const radius = globe.getGlobeRadius() * (1 + ROUTE_LIFT)
  const toVec = (lat, lng) => {
    const c = globe.getCoords(lat, lng, 0)
    return new Vector3(c.x, c.y, c.z).normalize()
  }

  // —— 控制点：真实途经点，段与段共享端点 ——
  const ctrl = []
  const stationCtrl = []
  ROUTE_SEGMENTS.forEach((waypoints, segIndex) => {
    waypoints.forEach((w, i) => {
      if (i === 0) stationCtrl[segIndex] = ctrl.length
      ctrl.push(toVec(w.lat, w.lng))
    })
  })
  stationCtrl[nodes.length - 1] = ctrl.length - 1

  const curve = new CatmullRomCurve3(ctrl, false, 'catmullrom', 0.5)
  const sampleCount = (ctrl.length - 1) * SAMPLES_PER_CTRL
  const samples = curve.getPoints(sampleCount).map((p) => p.clone().multiplyScalar(radius))

  // 累计弧长（归一化到 0~1）
  const sArr = new Float32Array(samples.length)
  let total = 0
  for (let i = 1; i < samples.length; i += 1) {
    total += samples[i].distanceTo(samples[i - 1])
    sArr[i] = total
  }
  for (let i = 0; i < sArr.length; i += 1) sArr[i] /= total || 1

  const stationS = nodes.map((_, i) => {
    const t = stationCtrl[i] / (ctrl.length - 1)
    return sArr[Math.min(sArr.length - 1, Math.round(t * sampleCount))]
  })

  // —— 一条线 ——
  const group = new Group()
  group.name = 'march-route'
  globe.scene().add(group)

  const flat = new Float32Array(samples.length * 3)
  samples.forEach((p, i) => {
    flat[i * 3] = p.x
    flat[i * 3 + 1] = p.y
    flat[i * 3 + 2] = p.z
  })

  const geo = new LineGeometry()
  geo.setPositions(flat)

  const coreMat = new LineMaterial({
    linewidth: 3,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  })
  const glowMat = new LineMaterial({
    linewidth: 16,
    vertexColors: true,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    blending: AdditiveBlending,
  })

  const core = new Line2(geo, coreMat)
  const glow = new Line2(geo, glowMat)
  core.renderOrder = 4
  glow.renderOrder = 3
  core.frustumCulled = false
  glow.frustumCulled = false
  group.add(glow, core)

  // —— 未烧段：稀疏火星点（不画虚线，避免廉价"引线感"）——
  const dotTexture = makeDotTexture()
  const emberPoints = []
  for (let i = 0; i < samples.length; i += 8) emberPoints.push(samples[i])
  const emberGeo = new BufferGeometry().setFromPoints(emberPoints)
  const emberMat = new PointsMaterial({
    color: EMBER,
    map: dotTexture,
    size: 0.9,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    alphaTest: 0.01,
  })
  const embers = new Points(emberGeo, emberMat)
  embers.renderOrder = 2
  group.add(embers)

  // —— 火星粒子 ——
  const SPARK_COUNT = 90
  const sparkPos = new Float32Array(SPARK_COUNT * 3)
  const sparkAlpha = new Float32Array(SPARK_COUNT)
  const sparks = Array.from({ length: SPARK_COUNT }, () => ({ life: 0, pos: new Vector3(), vel: new Vector3() }))
  const sparkGeo = new BufferGeometry()
  sparkGeo.setAttribute('position', new Float32BufferAttribute(sparkPos, 3))
  sparkGeo.setAttribute('alpha', new Float32BufferAttribute(sparkAlpha, 1))
  const sparkMat = new PointsMaterial({
    color: 0xffb46a,
    map: dotTexture,
    size: 1.1,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const sparkCloud = new Points(sparkGeo, sparkMat)
  sparkCloud.renderOrder = 6
  sparkCloud.frustumCulled = false
  group.add(sparkCloud)

  // —— 火头 ——
  const headCanvas = document.createElement('canvas')
  headCanvas.width = 128
  headCanvas.height = 128
  {
    const ctx = headCanvas.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,248,236,1)')
    g.addColorStop(0.18, 'rgba(255,205,140,0.9)')
    g.addColorStop(0.45, 'rgba(255,110,50,0.45)')
    g.addColorStop(1, 'rgba(140,30,20,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  }
  const head = new Sprite(
    new SpriteMaterial({
      map: new CanvasTexture(headCanvas),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  )
  head.scale.setScalar(0.02)
  head.renderOrder = 7
  head.visible = false
  group.add(head)

  // —— 状态 ——
  let burnedS = 0 // 已经烧到的弧长位置（0~1）
  let burn = null // { s0, s1, from, to, events, handlers, paused, speed }
  let raf = 0
  let lastTs = 0
  let visible = true
  const resolution = new Vector2(1, 1)
  if (globe.width && globe.height) resolution.set(globe.width(), globe.height())
  coreMat.resolution.copy(resolution)
  glowMat.resolution.copy(resolution)

  function colorArray(sHead) {
    const col = new Float32Array(samples.length * 3)
    const hot = new Color('#fff6e2')
    const mid = new Color('#ff8a2a')
    const fire = new Color('#ff4a18')
    const tmp = new Color()
    for (let i = 0; i < samples.length; i += 1) {
      const d = sHead - sArr[i]
      if (d < 0) {
        // 还没烧到：不画（instanceCount 已经截断，这里只是占位）
        col[i * 3] = 0
        col[i * 3 + 1] = 0
        col[i * 3 + 2] = 0
        continue
      }
      const headK = Math.min(1, d / HEAD_SPAN)
      if (headK < 0.35) tmp.copy(hot).lerp(mid, headK / 0.35)
      else tmp.copy(mid).lerp(fire, (headK - 0.35) / 0.65)

      const age = d / (burn?.speed || 0.02)
      const cool = Math.min(1, Math.max(0, (age - COOL_SECONDS) / 3.2))
      if (cool > 0) tmp.lerp(ASH, cool)

      col[i * 3] = tmp.r
      col[i * 3 + 1] = tmp.g
      col[i * 3 + 2] = tmp.b
    }
    return col
  }

  function applyProgress(sHead) {
    burnedS = Math.min(1, Math.max(0, sHead))
    let idx = 0
    while (idx + 1 < sArr.length && sArr[idx + 1] <= burnedS) idx += 1
    const count = burnedS <= 0 ? 0 : idx + 1
    geo.instanceCount = count
    core.visible = count > 1
    glow.visible = count > 1
    geo.setColors(colorArray(burnedS))

    // 火头
    if (count > 1) {
      head.position.copy(samples[Math.min(samples.length - 1, count - 1)])
      head.visible = true
    } else {
      head.visible = false
    }

    // 未烧段的火星点：按位置做一点闪
    embers.visible = visible && burnedS < 0.999
  }

  function pointAt(s) {
    let i = 1
    while (i < sArr.length - 1 && sArr[i] < s) i += 1
    return samples[i]
  }

  function spawnSparks(headPos, dt) {
    let budget = Math.max(1, Math.round(dt * 90))
    for (const p of sparks) {
      if (p.life > 0) continue
      if (budget <= 0) break
      const dir = headPos.clone().normalize()
      p.pos.copy(headPos).addScaledVector(dir, 0.0012 * Math.random())
      p.vel.copy(dir).multiplyScalar(0.004 + Math.random() * 0.006)
      p.vel.x += (Math.random() - 0.5) * 0.006
      p.vel.y += (Math.random() - 0.5) * 0.006
      p.vel.z += (Math.random() - 0.5) * 0.006
      p.life = 0.45 + Math.random() * 0.35
      budget -= 1
    }
  }

  function stepSparks(dt) {
    for (let i = 0; i < SPARK_COUNT; i += 1) {
      const p = sparks[i]
      if (p.life > 0) {
        p.life -= dt
        p.pos.addScaledVector(p.vel, dt * 60)
        sparkPos[i * 3] = p.pos.x
        sparkPos[i * 3 + 1] = p.pos.y
        sparkPos[i * 3 + 2] = p.pos.z
        sparkAlpha[i] = Math.max(0, p.life)
      } else {
        sparkAlpha[i] = 0
      }
    }
    sparkGeo.attributes.position.needsUpdate = true
    sparkGeo.attributes.alpha.needsUpdate = true
    sparkMat.opacity = 0.9
  }

  function tick(ts) {
    raf = 0
    if (!burn) return
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016)
    lastTs = ts

    if (!burn.paused) {
      burn.s += burn.speed * dt * 0.9
      // 事件点：走到就停
      const next = burn.events[0]
      if (next && burn.s >= next.s) {
        burn.s = next.s
        burn.paused = true
        burn.events.shift()
        burn.handlers.onEvent?.(next.event)
      }
      if (burn.s >= burn.s1) {
        burn.s = burn.s1
        finishBurn()
        return
      }
      applyProgress(burn.s)
      spawnSparks(head.position, dt)
      stepSparks(dt)
      head.scale.setScalar(0.02 * (1 + Math.sin(ts * 0.012) * 0.08))
    } else {
      stepSparks(dt)
    }

    raf = requestAnimationFrame(tick)
  }

  function finishBurn() {
    const handlers = burn?.handlers
    burn = null
    applyProgress(burnedS)
    sparkCloud.visible = false
    head.visible = false
    embers.visible = false
    handlers?.onDone?.()
  }

  function arm() {
    if (raf) return
    lastTs = performance.now()
    raf = requestAnimationFrame(tick)
  }

  return {
    group,
    /** 直接把火线摆到第 k 站（读档/重绘用） */
    setLit(indices) {
      const maxIdx = indices.length ? Math.max(...indices) : -1
      applyProgress(maxIdx >= 0 ? stationS[Math.min(stationS.length - 1, maxIdx)] : 0)
      embers.visible = visible && burnedS < 0.999
    },
    /** 从第 from 站烧到第 to 站（含事件暂停） */
    ignite(from, to, handlers = {}) {
      const s0 = stationS[Math.max(0, Math.min(stationS.length - 1, from))]
      const s1 = stationS[Math.max(0, Math.min(stationS.length - 1, to))]
      if (s1 <= s0) return

      const events = (handlers.events || [])
        .filter((e) => e.s > s0 && e.s <= s1)
        .sort((a, b) => a.s - b.s)

      const span = s1 - s0
      const speed = span / Math.min(3.6, Math.max(1.8, 1.6 + span * 26))

      burn = { s: s0, s0, s1, speed, events, handlers, paused: false }
      sparkCloud.visible = true
      head.visible = true
      head.position.copy(pointAt(s0))
      applyProgress(s0)
      arm()
    },
    skip() {
      if (!burn) return
      // 快进：先把还没弹的事件按顺序留在队列里，跳到终点后依次交给 App
      const pending = burn.events
      burn.events = []
      burn.s = burn.s1
      burn.paused = true
      applyProgress(burn.s1)
      if (pending.length) {
        pending.forEach((p) => burn.handlers.onEvent?.(p.event))
      }
      finishBurn()
    },
    resume() {
      if (!burn) return
      burn.paused = false
      arm()
    },
    clear() {
      burn = null
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      applyProgress(0)
      core.visible = false
      glow.visible = false
      head.visible = false
      sparkCloud.visible = false
      embers.visible = visible
    },
    setVisible(next) {
      visible = next
      group.visible = next
    },
    resize() {
      if (!globe.width || !globe.height) return
      resolution.set(globe.width(), globe.height())
      coreMat.resolution.copy(resolution)
      glowMat.resolution.copy(resolution)
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf)
      globe.scene().remove(group)
      geo.dispose()
      emberGeo.dispose()
      sparkGeo.dispose()
      coreMat.dispose()
      glowMat.dispose()
      emberMat.dispose()
      sparkMat.dispose()
    },
    get stationS() {
      return stationS
    },
  }
}
