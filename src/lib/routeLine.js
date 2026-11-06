/**
 * 璺嚎鐏嚎锛氫竴鏉′粠鐟為噾鍑哄彂銆佹寜闀垮緛椤哄簭寰€鍓嶇儳鐨勯摼銆?
 *
 * 涓轰粈涔堜笉鐢?three-globe 鑷甫鐨?pathsData锛?
 *   瀹冨簳灞傛槸 THREE.Line锛學ebGL 涓?linewidth 姘歌繙鏄?1px锛?
 *   鍋氫笉鍑?浣欑儸铏氱嚎 鈫?鐐圭噧鍚庣殑绮楀厜甯?杩欑灞傛銆?
 * 杩欓噷鏀圭敤 three/addons 鐨?Line2 + LineMaterial锛堝搴︽寜鍍忕礌绠楋紝闆舵柊渚濊禆锛夈€?
 *
 * 娓叉煋绾﹀畾锛?
 *   - 鏈儳鍒帮細鏆楃孩铏氱嚎锛堜綑鐑級锛屽憡璇変汉"璺湪杩欏効锛岃繕娌＄儳鍒?
 *   - 姝ｅ湪鐑э細鍑犱綍閫愬抚鐢熼暱锛岄鑹叉部鐏ご鍒嗕簲娈碉紙鐧界儹 鈫?鏄庨粍 鈫?姗?鈫?鏆楃孩 鈫?浣欑儸锛?
 *   - 鐑у畬浜嗭細鏁存鍙樻垚鏆楃孩瀹炵嚎锛屽儚鍦板浘涓婄暀涓嬬殑鐥曡抗
 *
 * 鎺ュ彛锛?
 *   setLit(indices)                     宸茬偣浜殑绔欙紙鐢ㄤ簬鎶?鐑у畬"鐨勬鐢诲嚭鏉ワ級
 *   ignite(fromSeg, toSeg, handlers)    渚濇鐑х from..to 娈?
 *   skip()                              蹇繘褰撳墠娈?
 *   resume()                            浠庝簨浠舵殏鍋滃缁х画
 *   resize(w, h) / dispose()
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { ROUTE_SEGMENTS } from './routePath.js'

// 姣忎袱涓€旂粡鐐逛箣闂撮噰鍑犱釜鐐癸細8 涓冻澶熻创鍚堢悆闈紝杩戠湅涓嶅嚭鎶樼嚎銆?
const SAMPLES_PER_WAYPOINT = 8
// 鎶鍦拌〃 0.4%锛岄伩寮€ z-fighting銆?
const ALTITUDE_LIFT = 0.02

const EMBER_COLOR = 0x9c2420
const ASH_COLOR = '#b0301c'

// 鐏ご寰€鍚庯細0 = 鐏ご锛? = 鍐峰嵈鐨勪綑鐑?
const FLAME_STOPS = [
  [0.0, new Color('#fff6e2')],
  [0.03, new Color('#ffc46a')],
  [0.11, new Color('#ff8a2a')],
  [0.3, new Color('#ff5a1f')],
  [0.55, new Color('#a8251a')],
  [0.78, new Color('#7a1a12')],
  [1.0, new Color(ASH_COLOR)],
]

function flameColor(d, out) {
  if (d <= 0) return out.copy(FLAME_STOPS[0][1])
  for (let i = 1; i < FLAME_STOPS.length; i += 1) {
    const [pos, color] = FLAME_STOPS[i]
    if (d <= pos) {
      const [prevPos, prevColor] = FLAME_STOPS[i - 1]
      const k = (d - prevPos) / (pos - prevPos || 1)
      return out.copy(prevColor).lerp(color, k)
    }
  }
  return out.copy(FLAME_STOPS[FLAME_STOPS.length - 1][1])
}

function slerp(a, b, t) {
  const dot = Math.min(1, Math.max(-1, a.dot(b)))
  const omega = Math.acos(dot)
  if (omega < 1e-5) return a.clone()
  const sin = Math.sin(omega)
  const wa = Math.sin((1 - t) * omega) / sin
  const wb = Math.sin(t * omega) / sin
  return new Vector3(
    a.x * wa + b.x * wb,
    a.y * wa + b.y * wb,
    a.z * wa + b.z * wb,
  )
}

export function createRouteLine(globe, nodes, events = []) {
  const radius = globe.getGlobeRadius() * (1 + ALTITUDE_LIFT)

  const toVec = (lat, lng) => {
    const c = globe.getCoords(lat, lng, 0)
    return new Vector3(c.x, c.y, c.z).normalize()
  }

  // 鈥斺€?姣忔鐨勯噰鏍风偣锛堝惈璧风偣銆佷笉鍚粓鐐癸紝娈典笌娈靛叡浜鐐癸級 鈥斺€?
  const segments = ROUTE_SEGMENTS.map((waypoints) => {
    const points = []
    for (let w = 0; w < waypoints.length - 1; w += 1) {
      const a = toVec(waypoints[w].lat, waypoints[w].lng)
      const b = toVec(waypoints[w + 1].lat, waypoints[w + 1].lng)
      const isLast = w === waypoints.length - 2
      const count = SAMPLES_PER_WAYPOINT + (isLast ? 1 : 0)
      for (let s = 0; s < count; s += 1) {
        const t = s / SAMPLES_PER_WAYPOINT
        const p = slerp(a, b, t).multiplyScalar(radius)
        points.push(p.x, p.y, p.z)
      }
    }
    return {
      positions: new Float32Array(points),
      count: points.length / 3,
      geo: null,
      ember: null,
      core: null,
      glow: null,
      state: 'ember', // ember | burning | burned
    }
  })

  const group = new Group()
  group.name = 'march-route'
  globe.scene().add(group)

  // 鈥斺€?鐏ご 鈥斺€?
  function makeHeadTexture() {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255, 244, 226, 1)')
    g.addColorStop(0.22, 'rgba(255, 168, 92, 0.82)')
    g.addColorStop(0.52, 'rgba(214, 66, 34, 0.3)')
    g.addColorStop(1, 'rgba(120, 24, 16, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new CanvasTexture(canvas)
  }

  const head = new Sprite(
    new SpriteMaterial({
      map: makeHeadTexture(),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  )
  head.scale.setScalar(0.016)
  head.renderOrder = 5
  head.visible = false
  group.add(head)

  let resolution = new Vector3(1, 1, 1)
  if (globe.width && globe.height) resolution.set(globe.width(), globe.height(), 1)

  function makeMaterials(width, opacity, additive) {
    return new LineMaterial({
      linewidth: width,
      transparent: true,
      opacity,
      vertexColors: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : undefined,
    })
  }

  // 鈥斺€?姣忔鐨勪笁涓璞★細浣欑儸铏氱嚎 / 鐏姱 / 鍏夋檿 鈥斺€?
  for (const seg of segments) {
    const emberGeo = new LineGeometry()
    emberGeo.setPositions(seg.positions)
    const emberMat = new LineMaterial({
      color: EMBER_COLOR,
      linewidth: 1.4,
      transparent: true,
      opacity: 0.58,
      dashed: true,
      dashSize: 0.035,
      gapSize: 0.03,
      depthWrite: false,
    })
    const ember = new Line2(emberGeo, emberMat)
    ember.computeLineDistances()
    ember.renderOrder = 1
    group.add(ember)
    seg.ember = ember

    const geo = new LineGeometry()
    geo.setPositions(seg.positions)
    const coreMat = makeMaterials(2.2, 0.9, false)
    const glowMat = makeMaterials(11, 0.22, true)
    const core = new Line2(geo, coreMat)
    const glow = new Line2(geo, glowMat)
    core.renderOrder = 3
    glow.renderOrder = 2
    core.visible = false
    glow.visible = false
    group.add(core)
    group.add(glow)
    seg.geo = geo
    seg.core = core
    seg.glow = glow
    seg.ember.visible = true
  }

  function applyResolution() {
    for (const seg of segments) {
      seg.ember.material.resolution.copy(resolution)
      seg.core.material.resolution.copy(resolution)
      seg.glow.material.resolution.copy(resolution)
    }
  }
  applyResolution()

  // 鈥斺€?鐘舵€?鈥斺€?
  let litIndices = []
  let burn = null // { seg, t, paused, events, handlers, skip }
  let raf = 0
  let lastTs = 0
  let breathing = 0

  const segmentSeconds = (i) => {
    const n = segments[i].count
    let len = 0
    for (let k = 1; k < n; k += 1) {
      const a = k * 3
      const b = (k - 1) * 3
      const dx = segments[i].positions[a] - segments[i].positions[b]
      const dy = segments[i].positions[a + 1] - segments[i].positions[b + 1]
      const dz = segments[i].positions[a + 2] - segments[i].positions[b + 2]
      len += Math.hypot(dx, dy, dz)
    }
    // 寮ч暱 鈫?绉掞細鏈€鐭?1.8s銆佹渶闀?3.6s
    const degSpan = (len / (radius / 57.3)) * 1
    return Math.min(3.6, Math.max(1.8, 1.6 + 0.35 * degSpan))
  }

  const durations = segments.map((_, i) => segmentSeconds(i))

  /** 鏌愭涓婅鏆傚仠鐨勪簨浠讹紙at 涓哄皬鏁版垨鏁存暟锛屾暣鏁?鍒扮珯锛?*/
  function eventsInSegment(i) {
    return events
      .filter((e) => e.at > i && e.at <= i + 1)
      .map((e) => ({ at: Math.min(0.97, e.at - i), ev: e }))
      .sort((a, b) => a.at - b.at)
  }

  /** 鎶婄 i 娈电敾鍒?t锛?~1锛夛紱t=1 琛ㄧず鏁存鐑у畬 */
  function drawSegment(i, t, cooled = false) {
    const seg = segments[i]
    const n = seg.count
    const headIndex = Math.max(1, Math.min(n, Math.ceil(t * (n - 1)) + 1))
    const pos = []
    const col = []
    const c = new Color()

    for (let k = 0; k < headIndex; k += 1) {
      const u = k / (n - 1)
      const base = k * 3
      pos.push(
        seg.positions[base],
        seg.positions[base + 1],
        seg.positions[base + 2],
      )
      if (cooled) {
        c.set(ASH_COLOR)
      } else {
        flameColor(Math.min(1, (t - u) / 0.6), c)
      }
      col.push(c.r, c.g, c.b)
    }

    seg.geo.setPositions(pos)
    seg.geo.setColors(col)
    seg.core.visible = true
    seg.glow.visible = true
    seg.ember.visible = t <= 0.001
  }

  function setSegmentBurned(i) {
    const seg = segments[i]
    const col = []
    const c = new Color(ASH_COLOR)
    for (let k = 0; k < seg.count; k += 1) col.push(c.r, c.g, c.b)
    seg.geo.setPositions(Array.from(seg.positions))
    seg.geo.setColors(col)
    seg.core.visible = true
    seg.glow.visible = true
    seg.ember.visible = false
    seg.state = 'burned'
  }

  function positionHead(i, t) {
    const seg = segments[i]
    const n = seg.count
    const f = Math.min(1, Math.max(0, t)) * (n - 1)
    const k = Math.floor(f)
    const frac = f - k
    const a = k * 3
    const b = Math.min(n - 1, k + 1) * 3
    const x = seg.positions[a] + (seg.positions[b] - seg.positions[a]) * frac
    const y = seg.positions[a + 1] + (seg.positions[b + 1] - seg.positions[a + 1]) * frac
    const z = seg.positions[a + 2] + (seg.positions[b + 2] - seg.positions[a + 2]) * frac
    head.position.set(x, y, z)
    head.visible = true
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016)
    lastTs = ts
    breathing += dt

    if (burn && !burn.paused) {
      burn.t += dt / burn.duration

      // 鍒颁簨浠剁偣灏卞仠浣?
      const next = burn.events[burn.cursor]
      if (next && burn.t >= next.at) {
        burn.t = next.at
        burn.paused = true
        drawSegment(burn.seg, burn.t)
        positionHead(burn.seg, burn.t)
        burn.handlers?.onEvent?.(next.ev)
      } else {
        if (burn.t >= 1) {
          burn.t = 1
          drawSegment(burn.seg, 1)
          setSegmentBurned(burn.seg)
          burn.handlers?.onSegment?.(burn.seg)
          const done = burn.seg >= burn.to
          if (done) {
            const h = burn.handlers
            burn = null
            head.visible = false
            stopLoop()
            h?.onDone?.()
            return
          }
          burn.seg += 1
          burn.t = 0
          burn.cursor = 0
          burn.events = eventsInSegment(burn.seg)
          burn.duration = durations[burn.seg]
        } else {
          drawSegment(burn.seg, burn.t)
          positionHead(burn.seg, burn.t)
        }
      }
    }

    // 鍛煎惛锛氱伀澶村拰鍏夋檿杞诲井璧蜂紡
    if (head.visible) {
      const k = 1 + 0.07 * Math.sin(breathing * 3.4)
      head.scale.setScalar(0.016 * k)
    }
    if (burn) {
      const g = 0.22 + 0.05 * Math.sin(breathing * 2.6)
      const seg = segments[burn.seg]
      if (seg.glow) seg.glow.material.opacity = g
    }

    raf = requestAnimationFrame(frame)
  }

  function startLoop() {
    if (raf) return
    lastTs = performance.now()
    raf = requestAnimationFrame(frame)
  }

  return {
    /** 宸茬偣浜殑绔欙細鎶?0..鏈€澶ц繛缁墠缂€ 鐨勬鏍囨垚"鐑ц繃"锛堜笉瑙﹀彂鍔ㄧ敾锛?*/
    setLit(indices) {
      litIndices = [...indices].sort((a, b) => a - b)
      let end = 0
      while (indices.includes(end) && end < nodes.length) end += 1
      for (let i = 0; i < segments.length; i += 1) {
        if (burn && i === burn.seg) continue
        if (i < end - 1) {
          if (segments[i].state !== 'burned') setSegmentBurned(i)
        } else if (segments[i].state === 'burned') {
          segments[i].state = 'ember'
          segments[i].core.visible = false
          segments[i].glow.visible = false
          segments[i].ember.visible = true
        }
      }
    },

    ignite(fromSeg, toSeg, handlers = {}) {
      if (fromSeg > toSeg) return
      burn = {
        seg: fromSeg,
        to: toSeg,
        t: 0,
        duration: durations[fromSeg],
        events: eventsInSegment(fromSeg),
        cursor: 0,
        paused: false,
        handlers,
      }
      segments[fromSeg].state = 'burning'
      drawSegment(fromSeg, 0)
      positionHead(fromSeg, 0)
      startLoop()
    },

    skip() {
      if (!burn) return
      burn.t = 1
      burn.paused = false
      // 璁╀笅涓€甯х珛鍒绘敹灏?
    },

    resume() {
      if (!burn) return
      burn.cursor += 1
      burn.paused = false
    },

    resize(w, h) {
      resolution.set(w, h, 1)
      applyResolution()
    },

    dispose() {
      stopLoop()
      for (const seg of segments) {
        seg.geo.dispose()
        seg.core.material.dispose()
        seg.glow.material.dispose()
        seg.ember.geometry.dispose()
        seg.ember.material.dispose()
      }
      globe.scene().remove(group)
    },
  }
}



