/**
 * 火焰头：32 帧程序化序列，一张 8×4 图集，运行时按 24fps 切帧。
 *
 * 为什么不用着色器长：fbm 长不出"焰舌"，参数一大就成月牙。
 * 这里是"画"出来的形状——底部宽、往上收、顶端分三缕，每帧相位不同。
 */
import { CanvasTexture, NormalBlending, Sprite, SpriteMaterial } from 'three'

const FRAMES = 32
const COLS = 8
const ROWS = 4
const CELL = 128

function buildAtlas() {
  const canvas = document.createElement('canvas')
  canvas.width = COLS * CELL
  canvas.height = ROWS * CELL
  const ctx = canvas.getContext('2d')

  for (let f = 0; f < FRAMES; f += 1) {
    const ox = (f % COLS) * CELL
    const oy = Math.floor(f / COLS) * CELL
    ctx.save()
    ctx.translate(ox, oy)
    ctx.clearRect(0, 0, CELL, CELL)
    ctx.globalCompositeOperation = 'lighter'

    const t = f / FRAMES
    const sway = Math.sin(t * Math.PI * 2) * 6

    // 主焰舌：底部宽 44，顶端收到 6，左右各摆一次
    const tipY = 14 + Math.sin(t * Math.PI * 2 + 1.2) * 6
    const body = new Path2D()
    body.moveTo(64 - 27, 112)
    body.quadraticCurveTo(64 - 20 + sway * 0.5, 64, 64 + sway, tipY)
    body.quadraticCurveTo(64 + 20 + sway * 0.5, 64, 64 + 27, 112)
    body.closePath()

    const g = ctx.createLinearGradient(0, 116, 0, tipY)
    g.addColorStop(0, 'rgba(255, 246, 224, 0.95)')
    g.addColorStop(0.28, 'rgba(255, 196, 104, 0.95)')
    g.addColorStop(0.62, 'rgba(255, 120, 36, 0.8)')
    g.addColorStop(1, 'rgba(196, 54, 20, 0)')
    ctx.fillStyle = g
    ctx.fill(body)

    // 两缕侧焰
    for (const dir of [-1, 1]) {
      const p = new Path2D()
      const h = 60 + Math.random() * 18
      p.moveTo(64 + dir * 12, 108)
      p.bezierCurveTo(
        64 + dir * 26,
        108 - h * 0.45,
        64 + dir * (16 + Math.random() * 8),
        108 - h,
        64 + dir * (8 + Math.random() * 6),
        108 - h * 0.92,
      )
      p.bezierCurveTo(64 + dir * 18, 108 - h * 0.5, 64 + dir * 16, 100, 64 + dir * 12, 108)
      p.closePath()
      ctx.fillStyle = `rgba(255, 150, 60, ${0.28 + Math.random() * 0.18})`
      ctx.fill(p)
    }

    // 白心
    const core = ctx.createRadialGradient(64 + sway * 0.4, 104, 1, 64 + sway * 0.4, 104, 7)
    core.addColorStop(0, 'rgba(255, 255, 244, 0.95)')
    core.addColorStop(0.5, 'rgba(255, 232, 180, 0.5)')
    core.addColorStop(1, 'rgba(255, 180, 90, 0)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(64 + sway * 0.4, 104, 7, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const tex = new CanvasTexture(canvas)
  tex.repeat.set(1 / COLS, 1 / ROWS)
  tex.offset.set(0, 1 - 1 / ROWS)
  tex.needsUpdate = true
  return tex
}

export function createFlame() {
  const tex = buildAtlas()
  const material = new SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
  })
  const sprite = new Sprite(material)
  sprite.frustumCulled = false
  sprite.visible = false

  let last = -1

  return {
    mesh: sprite,
    /** time 秒；size 世界单位高度 */
    update(time, size, intensity = 1) {
      const frame = Math.floor((time * 24) % FRAMES)
      if (frame !== last) {
        last = frame
        tex.offset.x = (frame % COLS) / COLS
        tex.offset.y = 1 - (Math.floor(frame / COLS) + 1) / ROWS
      }
      material.opacity = 0.9 * intensity
      // 高度 = size，宽度按焰舌比例略窄
      sprite.scale.set(size * 1.15, size * 1.7, 1)
    },
    dispose() {
      tex.dispose()
      material.dispose()
    },
  }
}
