/**
 * 闀垮緛璺嚎鐏嚎 鈥斺€?涓€鏉＄嚎锛屼粠鐟為噾鐑у埌浼氬畞銆?
 *
 * 杩欎竴鐗堝彧鍋氫笁浠朵簨锛屼絾閮芥槸"鍍忕伀"鐨勫繀瑕佹潯浠讹細
 *  1) 鐏ご涓嶆槸鍦嗙偣锛屾槸涓€绨囦細鎶栫殑鐏劙锛堢櫧蹇?+ 姗欑劙 + 涓婃壃鐨勭儫锛夛紱
 *  2) 鐑ц繃鐨勭嚎娈垫槸鐐紝涓嶆槸绾㈣壊闇撹櫣鈥斺€旂劍榛戦噷鍋跺皵闂竴涓嬫殫绾紱
 *  3) 鐏槦鏈夐噸鍔涖€佹湁瀵垮懡銆佷細鍐峰嵈锛屼粠鐏ご寰€鍚庢拻銆?
 *
 * 璐村湴楂樺害涓庡厜鐐瑰畬鍏ㄤ竴鑷达紙R 脳 1.0015锛夛紝渚ц涓嶄細娴捣鏉ャ€?
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
import { createFlame } from './flame.js'
import { createSparks } from './sparks.js'

/** 涓?EarthGlobe 鐨?htmlAltitude 淇濇寔涓€鑷?鈥斺€?绾胯创鍦帮紝鍏夌偣涔熻创鍦般€?*/
export const ROUTE_LIFT = 0.0015

const SAMPLES_PER_CTRL = 12
const HEAD_SPAN = 0.03 // 鐏ご鍒?鍒氱儳杩?鐨勮繃娓￠暱搴︼紙鍗犲叏绾垮姬闀匡級
const COOL_SECONDS = 0.85 // 鐑ц繃涔嬪悗澶氫箙澶卞幓浜害
const CHAR = new Color('#3d1009') // 鐑у敖鍚庣殑鐒﹂粦
const EMBER = new Color('#6f1712') // 娌＄儳鍒扮殑寮曠嚎

/** 鏌斿拰鐨勫渾鐐硅创鍥撅細Points 榛樿鐢绘柟鍧楋紝蹇呴』缁欒创鍥炬墠鍍忕伀鏄熴€?*/
function makeDotTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 236, 205, 1)')
  g.addColorStop(0.4, 'rgba(220, 96, 56, 0.7)')
  g.addColorStop(1, 'rgba(120, 24, 16, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

/** 鐏劙璐村浘锛歝ore = 鐧藉績锛宖lame = 姗欑劙锛宻moke = 鐏扮儫銆?*/
function makeFlameTexture(kind) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(64, 72, 2, 64, 64, 62)

  if (kind === 'core') {
    g.addColorStop(0, 'rgba(255, 252, 240, 1)')
    g.addColorStop(0.25, 'rgba(255, 240, 200, 0.95)')
    g.addColorStop(0.6, 'rgba(255, 190, 110, 0.35)')
    g.addColorStop(1, 'rgba(255, 120, 40, 0)')
  } else if (kind === 'smoke') {
    g.addColorStop(0, 'rgba(90, 52, 40, 0.32)')
    g.addColorStop(0.5, 'rgba(60, 34, 28, 0.16)')
    g.addColorStop(1, 'rgba(30, 16, 14, 0)')
  } else {
    g.addColorStop(0, 'rgba(255, 196, 120, 0.95)')
    g.addColorStop(0.35, 'rgba(255, 122, 42, 0.8)')
    g.addColorStop(0.7, 'rgba(196, 52, 22, 0.35)')
    g.addColorStop(1, 'rgba(120, 24, 12, 0)')
  }

  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

export function createRouteLine(globe, nodes) {
  const radius = globe.getGlobeRadius() * (1 + ROUTE_LIFT)
  const toVec = (lat, lng) => {
    const c = globe.getCoords(lat, lng, 0)
    return new Vector3(c.x, c.y, c.z).normalize()
  }

  // 鈥斺€?鎺у埗鐐癸細鐪熷疄閫旂粡鐐癸紝娈典笌娈靛叡浜鐐?鈥斺€?
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

  // 绱寮ч暱锛堝綊涓€鍖栧埌 0~1锛?
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

  // 鈥斺€?涓€鏉＄嚎 鈥斺€?
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
    linewidth: 3.6,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  })
  // 鍏夋檿鏀跺緱寰堢揣锛氬彧鍦ㄧ伀澶撮檮杩戜寒锛岀儳杩囩殑鍦版柟涓嶅彂鍏?
  const glowMat = new LineMaterial({
    linewidth: 11,
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: AdditiveBlending,
  })

  // 鐒﹀湡甯︼細姣旂嚎瀹?3 鍊嶇殑涓€灞傛殫鑹诧紝璁?鐑ц繃鐨勫湴琛?鏈夌棔杩?
  const charMat = new LineMaterial({
    linewidth: 10,
    color: 0x140604,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  })
  const charBand = new Line2(geo, charMat)
  charBand.renderOrder = 2

  const core = new Line2(geo, coreMat)
  const glow = new Line2(geo, glowMat)
  core.renderOrder = 4
  glow.renderOrder = 3
  core.frustumCulled = false
  glow.frustumCulled = false
  group.add(charBand, glow, core)

  // 鈥斺€?鏈儳娈碉細绋€鐤忓喎寮曠嚎锛堟殫绾㈢偣锛屼笉鏄櫄绾匡級鈥斺€?
  const dotTexture = makeDotTexture()
  const emberPoints = []
  for (let i = 0; i < samples.length; i += 10) emberPoints.push(samples[i])
  const emberGeo = new BufferGeometry().setFromPoints(emberPoints)
  const emberMat = new PointsMaterial({
    color: EMBER,
    map: dotTexture,
    size: 0.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    alphaTest: 0.01,
  })
  const embers = new Points(emberGeo, emberMat)
  embers.renderOrder = 2
  group.add(embers)

  // 鈥斺€?鐏槦锛氭湁閲嶅姏銆佹湁瀵垮懡銆佷細鍐峰嵈 鈥斺€?
  const SPARK_COUNT = 140
  const sparkPos = new Float32Array(SPARK_COUNT * 3)
  const sparkCol = new Float32Array(SPARK_COUNT * 3)
  const sparks = Array.from({ length: SPARK_COUNT }, () => ({
    life: 0,
    maxLife: 1,
    pos: new Vector3(),
    vel: new Vector3(),
  }))
  const sparkGeo = new BufferGeometry()
  sparkGeo.setAttribute('position', new Float32BufferAttribute(sparkPos, 3))
  sparkGeo.setAttribute('color', new Float32BufferAttribute(sparkCol, 3))
  const sparkMat = new PointsMaterial({
    map: dotTexture,
    vertexColors: true,
    size: 6.0,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const sparkCloud = new Points(sparkGeo, sparkMat)
  sparkCloud.renderOrder = 6
  sparkCloud.frustumCulled = false
  group.add(sparkCloud)

  // 鈥斺€?鐏ご锛氱櫧蹇?+ 姗欑劙 + 鐑燂紝涓夊眰涓€璧锋姈 鈥斺€?
  const headGroup = new Group()
  const headCore = new Sprite(
    new SpriteMaterial({
      map: makeFlameTexture('core'),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  )
  headCore.scale.setScalar(0.6)
  const headFlame = new Sprite(
    new SpriteMaterial({
      map: makeFlameTexture('flame'),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
    }),
  )
  headFlame.scale.setScalar(1.3)
  const headSmoke = new Sprite(
    new SpriteMaterial({
      map: makeFlameTexture('smoke'),
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  )
  headSmoke.scale.setScalar(1.8)
  headSmoke.position.y = 0.012
  headGroup.add(headSmoke, headFlame, headCore)
  // 着色器火焰：屏幕空间定尺寸，任何视高都是 40~60px
  const flame = createFlame()
  headCore.visible = false
  headFlame.visible = false
  headSmoke.visible = false
  flame.mesh.visible = true
  flame.mesh.renderOrder = 9
  flame.mesh.scale.set(1, 1, 1)
  flame.mesh.position.set(0, 0, 0)
  group.add(flame.mesh)

  // 火星粒子池（InstancedMesh，一次 draw call）
  const sparkPool = createSparks(48)
  sparkPool.mesh.renderOrder = 6
  group.add(sparkPool.mesh)
  headGroup.renderOrder = 7
  headGroup.visible = false
  // 旧柔光 headGroup 不再入场，全部由 flame.mesh 承担

  // 姣忎釜閲囨牱鐐硅鐑у埌鐨勬椂鍒伙紙-1 = 杩樻病鐑у埌锛夆€斺€斿喎鍗存寜鐪熷疄鏃堕棿绠?
  const burnTime = new Float32Array(samples.length).fill(-1)

  // 鈥斺€?鐘舵€?鈥斺€?
  let burnedS = 0
  let burn = null
  let raf = 0
  let lastTs = 0
  let clock = 0
  let visible = true
  const resolution = new Vector2(1, 1)
  if (globe.width && globe.height) resolution.set(globe.width(), globe.height())
  coreMat.resolution.copy(resolution)
  glowMat.resolution.copy(resolution)

  const tmpColor = new Color()
  const hotWhite = new Color('#fff8e8')
  const fireOrange = new Color('#ff8a2a')
  const deepRed = new Color('#b8321a')

  function colorArray(now) {
    const col = new Float32Array(samples.length * 3)
    for (let i = 0; i < samples.length; i += 1) {
      const t0 = burnTime[i]
      if (t0 < 0) continue

      const age = now - t0
      if (age < 0.28) {
        // 鍒氳鐐圭潃锛氱櫧蹇?鈫?姗?
        const k = age / 0.28
        if (k < 0.45) tmpColor.copy(hotWhite).lerp(fireOrange, k / 0.45)
        else tmpColor.copy(fireOrange).lerp(deepRed, (k - 0.45) / 0.55)
      } else {
        // 涔嬪悗锛氭繁绾?鈫?鐒﹂粦锛岀暀涓€鐐圭偔鐏殑鍛煎惛
        const cool = Math.min(1, (age - 0.28) / COOL_SECONDS)
        tmpColor.copy(deepRed).lerp(CHAR, cool)
        const flicker = 0.5 + 0.5 * Math.sin(now * 2.4 + i * 0.7)
        tmpColor.offsetHSL(0, 0, 0.02 * flicker * (1 - cool))
      }

      col[i * 3] = tmpColor.r
      col[i * 3 + 1] = tmpColor.g
      col[i * 3 + 2] = tmpColor.b
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
    charBand.visible = count > 1
    for (let i = 0; i < samples.length; i += 1) {
      if (sArr[i] <= burnedS && burnTime[i] < 0) burnTime[i] = clock
    }
    geo.setColors(colorArray(clock))

    if (count > 1) {
      headGroup.position.copy(samples[Math.min(samples.length - 1, count - 1)])
      flame.mesh.position.copy(headGroup.position).multiplyScalar(1.03)
      headGroup.visible = true
    } else {
      headGroup.visible = false
    }

    embers.visible = visible && burnedS < 0.999
  }

  function pointAt(s) {
    let i = 1
    while (i < sArr.length - 1 && sArr[i] < s) i += 1
    return samples[i]
  }

  const up = new Vector3()
  function spawnSparks(headPos, dt) {
    let budget = Math.max(1, Math.round(dt * 110))
    for (const p of sparks) {
      if (p.life > 0) continue
      if (budget <= 0) break
      up.copy(headPos).normalize()
      p.pos.copy(headPos)
      // 鍚戞枩涓婃柟鎶涳細娌垮湴琛ㄥ垏鍚?+ 涓€涓悜涓婄殑鍒嗛噺
      p.vel.set(
        (Math.random() - 0.5) * 0.34,
        (Math.random() - 0.5) * 0.34,
        (Math.random() - 0.5) * 0.34,
      )
      p.vel.addScaledVector(up, 0.16 + Math.random() * 0.22)
      p.maxLife = 0.7 + Math.random() * 0.7
      p.life = p.maxLife
      budget -= 1
    }
  }

  const gravity = new Vector3()
  function stepSparks(dt) {
    for (let i = 0; i < SPARK_COUNT; i += 1) {
      const p = sparks[i]
      if (p.life <= 0) {
        sparkCol[i * 3] = 0
        sparkCol[i * 3 + 1] = 0
        sparkCol[i * 3 + 2] = 0
        continue
      }
      p.life -= dt
      // 閲嶅姏鏈濈悆蹇?
      gravity.copy(p.pos).normalize().multiplyScalar(-0.55 * dt)
      p.vel.add(gravity)
      p.pos.addScaledVector(p.vel, dt)

      const k = Math.max(0, p.life / p.maxLife) // 1 鈫?0
      // 鍐峰嵈锛氫寒榛?鈫?鏆楃孩锛屾渶鍚庤鍔犺壊娣峰悎"鐔勭伃"
      const c = 0.25 + 0.75 * k
      sparkCol[i * 3] = c
      sparkCol[i * 3 + 1] = c * (0.35 + 0.45 * k)
      sparkCol[i * 3 + 2] = c * (0.1 + 0.2 * k)

      sparkPos[i * 3] = p.pos.x
      sparkPos[i * 3 + 1] = p.pos.y
      sparkPos[i * 3 + 2] = p.pos.z
    }
    sparkGeo.attributes.position.needsUpdate = true
    sparkGeo.attributes.color.needsUpdate = true
  }

  const _v = new Vector3()
  const _c = new Vector3()
  /** 把"屏幕 48px"换算成世界尺寸：size = dist * 2*tan(fov/2) * (48 / 高度) */
  function headWorldSize() {
    const cam = globe.camera()
    if (!cam) return 1.2
    _v.copy(headGroup.position)
    const dist = cam.position.distanceTo(_v)
    const fov = (cam.fov * Math.PI) / 180
    const h = (typeof window !== 'undefined' && window.innerHeight) || 1080
    return dist * 2 * Math.tan(fov / 2) * (48 / h)
  }

  function animateHead(now, speed) {
    const cam = globe.camera()
    if (cam) {
      _c.copy(cam.position).sub(headGroup.position).normalize()
      // 让火焰平面朝向相机
      headGroup.quaternion.copy(cam.quaternion)
      // 稍微朝燃烧方向倾斜
      if (speed) headGroup.rotateZ(-0.06)
    }
    const f1 = Math.sin(now * 23.0) * 0.5 + Math.sin(now * 37.7 + 1.3) * 0.5
    const f2 = Math.sin(now * 17.3 + 2.1)
    headCore.scale.setScalar(0.6 * (1 + f1 * 0.09))
    headFlame.scale.setScalar(1.3 * (1 + f2 * 0.12))
    headFlame.material.opacity = 0.85 + f1 * 0.1
    headSmoke.scale.setScalar(1.8 + 0.2 * ((now * 0.6) % 1))
    headSmoke.material.opacity = 0.4 * (1 - ((now * 0.6) % 1))
    headSmoke.position.y = 0.04 + 0.09 * ((now * 0.6) % 1)
    headGroup.rotation.z = f2 * 0.06
    flame.update(now, headWorldSize(), 1)
  }

  function tick(ts) {
    raf = 0
    if (!burn) {
      // 涓嶅湪鐕冪儳鏃朵篃璁╃偔鐏交寰懠鍚?
      if (burnedS > 0) applyProgress(burnedS)
      return
    }
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016)
    lastTs = ts
    clock += dt

    if (!burn.paused) {
      burn.s += burn.speed * dt * 0.9
      const next = burn.events[0]
      if (next && burn.s >= next.s) {
        burn.s = next.s
        burn.paused = true
        burn.events.shift()
        burn.handlers.onEvent?.(next.event)
      }
      if (burn.s >= burn.s1) {
        burn.s = burn.s1
        applyProgress(burn.s)
        finishBurn()
        return
      }
      applyProgress(burn.s)
      spawnSparks(headGroup.position, dt)
      _v.copy(headGroup.position).normalize()
      sparkPool.spawn(headGroup.position, _v, 3, globe.camera().quaternion)
      animateHead(clock, burn.speed)
    }
    stepSparks(dt)
    sparkPool.update(dt, globe.camera() ? globe.camera().quaternion : null)

    raf = requestAnimationFrame(tick)
  }

  function finishBurn() {
    const handlers = burn?.handlers
    burn = null
    applyProgress(burnedS)
    sparkCloud.visible = false
    headGroup.visible = false
    embers.visible = false
    // 火焰贴图必须显式收起：它不挂在 headGroup 上，漏掉就会停在最后一个火头处
    flame.mesh.visible = false
    startIdle()
    handlers?.onDone?.()
  }

  // 鐑у畬鍚庣殑浣欑儸鍛煎惛锛?0fps 鐨勪綆棰戝埛鏂帮紝涓嶅崰 CPU
  let idleRaf = 0
  let idleLast = 0
  function idleTick(ts) {
    idleRaf = 0
    if (burn) return
    if (ts - idleLast < 50) {
      idleRaf = requestAnimationFrame(idleTick)
      return
    }
    idleLast = ts
    clock += 0.05
    if (burnedS > 0) geo.setColors(colorArray(clock))
    idleRaf = requestAnimationFrame(idleTick)
  }
  function startIdle() {
    if (idleRaf) return
    idleLast = 0
    idleRaf = requestAnimationFrame(idleTick)
  }

  function arm() {
    if (raf) return
    lastTs = performance.now()
    raf = requestAnimationFrame(tick)
  }

  return {
    group,
    setLit(indices) {
      const maxIdx = indices.length ? Math.max(...indices) : -1
      applyProgress(maxIdx >= 0 ? stationS[Math.min(stationS.length - 1, maxIdx)] : 0)
      embers.visible = visible && burnedS < 0.999
    },
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
      sparkCloud.visible = false
      sparkPool.setVisible(true)
      headGroup.visible = true
      headGroup.position.copy(pointAt(s0))
      applyProgress(s0)
      arm()
    },
    skip() {
      if (!burn) return
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
      if (idleRaf) cancelAnimationFrame(idleRaf)
      raf = 0
      idleRaf = 0
      burnTime.fill(-1)
      applyProgress(0)
      core.visible = false
      glow.visible = false
      charBand.visible = false
      headGroup.visible = false
      sparkCloud.visible = false
      flame.mesh.visible = false
      group.visible = false
      embers.visible = visible
    },
    setVisible(next) {
      visible = next
      group.visible = next
      // 火焰只在燃烧时可见；单纯显示火线组不该把它带出来
      flame.mesh.visible = next && !!burn
    },
    resize() {
      if (!globe.width || !globe.height) return
      resolution.set(globe.width(), globe.height())
      coreMat.resolution.copy(resolution)
      glowMat.resolution.copy(resolution)
    charMat.resolution.copy(resolution)
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




