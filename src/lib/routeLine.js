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

/** 涓?EarthGlobe 鐨?htmlAltitude 淇濇寔涓€鑷?鈥斺€?绾胯创鍦帮紝鍏夌偣涔熻创鍦般€?*/
export const ROUTE_LIFT = 0.0015

const SAMPLES_PER_CTRL = 12
const HEAD_SPAN = 0.03 // 鐏ご鍒?鍒氱儳杩?鐨勮繃娓￠暱搴︼紙鍗犲叏绾垮姬闀匡級
const COOL_SECONDS = 0.85 // 鐑ц繃涔嬪悗澶氫箙澶卞幓浜害
const CHAR = new Color('#4d1509') // 鐑у敖鍚庣殑鐒﹂粦
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

  // 采样点的经纬度：钉/事件标都从这里取，保证与线严格同源
  const samplesLL = samples.map((v) => globe.toGeoCoords(v))

  // 站点弧长：取“离站点最近的采样点”，而不是控制点序号比例
  // （Catmull-Rom 的参数不是弧长均匀的，途经点密处会偏）
  const stationS = nodes.map((n) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < samplesLL.length; i += 1) {
      const dLat = samplesLL[i].lat - n.lat
      const dLng = (samplesLL[i].lng - n.lng) * Math.cos((n.lat * Math.PI) / 180)
      const d = dLat * dLat + dLng * dLng
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return sArr[best]
  })

  // 鈥斺€?涓€鏉＄嚎 鈥斺€?
  const group = new Group()
  group.name = 'march-route'
  globe.scene().add(group)

  // 四渡回环已移除：主线已含该段，重复注记会在赤水留下残线


  const flat = new Float32Array(samples.length * 3)
  samples.forEach((p, i) => {
    flat[i * 3] = p.x
    flat[i * 3 + 1] = p.y
    flat[i * 3 + 2] = p.z
  })

  const geo = new LineGeometry()
  geo.setPositions(flat)

  const coreMat = new LineMaterial({
    linewidth: 2.6,
    color: 0x8c2a17,
    transparent: true,
    depthWrite: false,
  })
  // 鍏夋檿鏀跺緱寰堢揣锛氬彧鍦ㄧ伀澶撮檮杩戜寒锛岀儳杩囩殑鍦版柟涓嶅彂鍏?
  const glowMat = new LineMaterial({
    linewidth: 26,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: AdditiveBlending,
  })

  // 鐒﹀湡甯︼細姣旂嚎瀹?3 鍊嶇殑涓€灞傛殫鑹诧紝璁?鐑ц繃鐨勫湴琛?鏈夌棔杩?
  const charMat = new LineMaterial({
    linewidth: 9,
    color: 0x140604,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  })
  const charBand = new Line2(geo, charMat)
  charBand.renderOrder = 2

  const glowGeo = new LineGeometry()
  glowGeo.setPositions(flat)
  const core = new Line2(geo, coreMat)
  const glow = new Line2(glowGeo, glowMat)
  core.renderOrder = 4
  glow.renderOrder = 3
  core.frustumCulled = false
  glow.frustumCulled = false
  group.add(charBand, glow, core)


  // 鈥斺€?鏈儳娈碉細绋€鐤忓喎寮曠嚎锛堟殫绾㈢偣锛屼笉鏄櫄绾匡級鈥斺€?
    const dotTexture = makeDotTexture()

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
  const hotWhite = new Color('#ffe6b8')
  const fireOrange = new Color('#c53a1d')
  const deepRed = new Color('#7d2113')

  function colorArray(now) {
    const col = new Float32Array(samples.length * 3)
    for (let i = 0; i < samples.length; i += 1) {
      const t0 = burnTime[i]
      if (t0 < 0) continue

      const age = now - t0
      if (age < 0.12) {
        // 鍒氳鐐圭潃锛氱櫧蹇?鈫?姗?
        const k = age / 0.12
        if (k < 0.45) tmpColor.copy(hotWhite).lerp(fireOrange, k / 0.45)
        else tmpColor.copy(fireOrange).lerp(deepRed, (k - 0.45) / 0.55)
      } else {
        // 涔嬪悗锛氭繁绾?鈫?鐒﹂粦锛岀暀涓€鐐圭偔鐏殑鍛煎惛
        const cool = Math.min(1, (age - 0.12) / COOL_SECONDS)
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
    glow.visible = false
    charBand.visible = count > 1
    for (let i = 0; i < samples.length; i += 1) {
      if (sArr[i] <= burnedS && burnTime[i] < 0) burnTime[i] = clock
    }
    const cc = colorArray(clock)
    geo.setColors(cc)
    if (count > 1) {
      const headS = sArr[count - 1]
      const gc = new Float32Array(samples.length * 3)
      for (let i = 0; i < samples.length; i += 1) {
        const d = (headS - sArr[i]) / 0.05
        if (d < 0 || d > 1) continue
        const k = (1 - d) * (1 - d)
        gc[i * 3] = cc[i * 3] * k
        gc[i * 3 + 1] = cc[i * 3 + 1] * k
        gc[i * 3 + 2] = cc[i * 3 + 2] * k
      }
      glowGeo.setColors(gc)
    }

    if (count > 1) {
      const head = samples[Math.min(samples.length - 1, count - 1)]
    } else {
    }

  }

  function pointAt(s) {
    let i = 1
    while (i < sArr.length - 1 && sArr[i] < s) i += 1
    return samples[i]
  }

  const up = new Vector3()
  function spawnSparks(headPos, dt) {
    const base = pointAt(Math.max(0, burnedS * Math.random() * 0.96))
    let budget = Math.max(1, Math.round(dt * 26))
    for (const p of sparks) {
      if (p.life > 0) continue
      if (budget <= 0) break
      up.copy(base).normalize()
      p.pos.copy(base)
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
    const dist = cam.position.distanceTo(_v)
    const fov = (cam.fov * Math.PI) / 180
    const h = (typeof window !== 'undefined' && window.innerHeight) || 1080
    return dist * 2 * Math.tan(fov / 2) * (46 / h)
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
    }
    raf = requestAnimationFrame(tick)
  }

  function finishBurn() {
    const handlers = burn?.handlers
    burn = null
    applyProgress(burnedS)
    // 火焰贴图必须显式收起：它不挂在 headGroup 上，漏掉就会停在最后一个火头处
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
    get headS() {
      return burnedS
    },
    latLngAtS(s) {
      let i = 0
      while (i + 1 < sArr.length && sArr[i + 1] <= s) i += 1
      return samplesLL[i]
    },
    get headLatLng() {
      let i = 0
      while (i + 1 < sArr.length && sArr[i + 1] <= burnedS) i += 1
      return samplesLL[i]
    },
    setLit(indices) {
      const maxIdx = indices.length ? Math.max(...indices) : -1
      applyProgress(maxIdx >= 0 ? stationS[Math.min(stationS.length - 1, maxIdx)] : 0)
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
        group.visible = false
    },
    setVisible(next) {
      visible = next
      group.visible = next
      // 火焰只在燃烧时可见；单纯显示火线组不该把它带出来
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




