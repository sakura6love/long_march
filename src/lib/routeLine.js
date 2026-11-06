/**
 * 路线火线：把 12 个孤立的点，连成一条会烧起来的路。
 *
 * 为什么不用 three-globe 自带的 pathsData：
 *   它底层是 THREE.Line，WebGL 里 linewidth 永远只有 1px，
 *   做不出"余烬虚线 → 点燃后的粗光带"这种层次。
 * 这里改用 three/addons 的 Line2 + LineMaterial（宽度按像素算），
 * 好处是零新依赖、屏幕宽度恒定、随相机远近不变粗变细。
 *
 * 约定：
 *   - 未走过：一条暗红虚线（余烬）
 *   - 已走过：亮橙实线 + 外面一层加色混合的光晕
 *   - 线整体抬离地表 0.4%，避免和球面 z-fighting
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
import { ROUTE_SEGMENTS } from './routePath.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'

// 每两个途经点之间采样多少个点：8 个足够贴合球面，肉眼看不出折线。
const SAMPLES_PER_WAYPOINT = 8
// 抬离地表的比例（以球半径为单位）。
const ALTITUDE_LIFT = 0.004

const EMBER_COLOR = 0x9c2420
const FIRE_NEAR = new Color('#ff5a1f')
const FIRE_FAR = new Color('#ff9a5a')

const deg = (v) => (v * Math.PI) / 180

/**
 * 在球面上做球面线性插值：两点之间的最短大圆弧。
 * 直接用 getCoords 取三维坐标，能绕过 globe.gl 的经纬度 → 轴向换算细节。
 */
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

/**
 * @param {object} globe  globe.gl 实例
 * @param {Array}  nodes  data.js 里的 12 个节点
 */
export function createRouteLine(globe, nodes) {
  const radius = globe.getGlobeRadius() * (1 + ALTITUDE_LIFT)

  // 经纬度 → 单位向量，用来做球面插值。
  const toVec = (lat, lng) => {
    const c = globe.getCoords(lat, lng, 0)
    return new Vector3(c.x, c.y, c.z).normalize()
  }

  // 按真实途经点铺线：每两个途经点之间仍走大圆弧，但拐点处会跟着史料转弯。
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
    return points
  })

  // 火头：用 canvas 现画一张径向渐变，避免再多一个图片资源。
  function makeHeadTexture() {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255, 236, 210, 0.95)')
    g.addColorStop(0.25, 'rgba(255, 150, 80, 0.75)')
    g.addColorStop(0.55, 'rgba(214, 70, 40, 0.28)')
    g.addColorStop(1, 'rgba(120, 24, 16, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new CanvasTexture(canvas)
  }

  const group = new Group()
  group.name = 'march-route'
  globe.scene().add(group)

  // —— 余烬：整条路先铺一条暗红虚线，代表"还没烧到" ——
  const emberGeometry = new LineGeometry()
  const emberPoints = []
  for (const seg of segments) emberPoints.push(...seg)
  emberGeometry.setPositions(emberPoints)
  const emberMaterial = new LineMaterial({
    color: EMBER_COLOR,
    linewidth: 1.4,
    transparent: true,
    opacity: 0.64,
    dashed: true,
    dashSize: 0.035,
    gapSize: 0.03,
    depthWrite: false,
  })
  const headMaterial = new SpriteMaterial({
    map: makeHeadTexture(),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  })
  const head = new Sprite(headMaterial)
  head.scale.setScalar(0.012)
  head.renderOrder = 4
  head.visible = false
  group.add(head)

  const emberLine = new Line2(emberGeometry, emberMaterial)
  emberLine.computeLineDistances()
  emberLine.renderOrder = 1
  group.add(emberLine)

  // —— 火线：只画已经走过的段，每次点亮时重建 ——
  const fireGroup = new Group()
  group.add(fireGroup)

  let currentLit = new Set()

  function clearFire() {
    for (const child of [...fireGroup.children]) {
      fireGroup.remove(child)
      child.geometry.dispose()
    }
    fireGroup.clear()
  }

  /**
   * 重建"已点燃"的几何。
   * 把连续点亮的段合并成一条折线，这样颜色可以沿整条火线
   * 从橙红烧到浅金，而不是每段各烧一遍（否则接缝处会反复回色）。
   */
  function rebuildFire(progress = -1) {
    clearFire()

    // 找出所有连续点亮的区间 [start, end]
    const runs = []
    if (progress >= 0) {
      // 播放模式：从瑞金开始一段一段烧过来，颜色自然是一头橙一头金。
      if (progress > 0) runs.push([0, Math.min(progress, segments.length) - 1])
    }
    let start = progress >= 0 ? -2 : -1
    for (let i = 0; progress < 0 && i <= segments.length; i += 1) {
      const lit = i < segments.length && currentLit.has(nodes[i].id)
      if (lit && start === -1) start = i
      if (!lit && start !== -1) {
        runs.push([start, i - 1])
        start = -1
      }
    }

    for (const [from, to] of runs) {
      // 拼接这一段连续路程的所有采样点
      const points = []
      for (let i = from; i <= to; i += 1) points.push(...segments[i])

      const count = points.length / 3
      // 按累计弧长分配颜色，保证整条火线是"一头橙、一头金"的连续渐变
      const colors = []
      let total = 0
      const dists = [0]
      for (let p = 1; p < count; p += 1) {
        const dx = points[p * 3] - points[(p - 1) * 3]
        const dy = points[p * 3 + 1] - points[(p - 1) * 3 + 1]
        const dz = points[p * 3 + 2] - points[(p - 1) * 3 + 2]
        total += Math.hypot(dx, dy, dz)
        dists.push(total)
      }
      for (let p = 0; p < count; p += 1) {
        const t = total > 0 ? dists[p] / total : 0
        const c = FIRE_NEAR.clone().lerp(FIRE_FAR, t)
        colors.push(c.r, c.g, c.b)
      }

      const geometry = new LineGeometry()
      geometry.setPositions(points)
      geometry.setColors(colors)

      const core = new Line2(
        geometry,
        new LineMaterial({
          linewidth: 2.2,
          vertexColors: true,
          transparent: true,
          opacity: 0.86,
          depthWrite: false,
        }),
      )
      core.renderOrder = 3
      fireGroup.add(core)

      const glow = new Line2(
        geometry,
        new LineMaterial({
          linewidth: 11,
          vertexColors: true,
          transparent: true,
          opacity: 0.24,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      )
      glow.renderOrder = 2
      fireGroup.add(glow)
    }
  }

  function update(litIds, progress = -1) {
    currentLit = new Set(litIds || [])
    rebuildFire(progress)

    // 火头停在"走到的最远一站"上。
    let lastIndex = -1
    if (progress >= 0) {
      lastIndex = Math.min(progress, nodes.length - 1)
    } else {
      for (let i = 0; i < nodes.length; i += 1) {
        if (currentLit.has(nodes[i].id)) lastIndex = i
      }
    }
    if (lastIndex >= 0) {
      const p = toVec(nodes[lastIndex].lat, nodes[lastIndex].lng).multiplyScalar(radius)
      head.position.copy(p)
      head.visible = true
    } else {
      head.visible = false
    }
  }

  function resize(width, height) {
    emberMaterial.resolution.set(width, height)
    for (const child of fireGroup.children) {
      child.material.resolution.set(width, height)
    }
  }

  function dispose() {
    clearFire()
    emberGeometry.dispose()
    emberMaterial.dispose()
    headMaterial.map.dispose()
    headMaterial.dispose()
    globe.scene().remove(group)
  }

  return { update, resize, dispose }
}
