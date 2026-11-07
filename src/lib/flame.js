/**
 * 火焰头：三层贴图叠出一团会抖的火。
 * 外焰（橙、细长）、内焰（金）、核心（白黄、加法），外加一层暗底保证在亮地表上也读得出。
 */
import { CanvasTexture, Group, Sprite, SpriteMaterial, TextureLoader } from 'three'

function radialTexture(inner, mid, outer) {
  const s = 256
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, inner)
  g.addColorStop(0.55, mid)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new CanvasTexture(c)
}

export function createFlame() {
  const group = new Group()
  group.visible = false

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 地面光斑
  const glow = ctx.createRadialGradient(size / 2, size * 0.84, 2, size / 2, size * 0.84, size * 0.2)
  glow.addColorStop(0, 'rgba(255, 196, 110, 0.30)')
  glow.addColorStop(1, 'rgba(255, 150, 60, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, size * 0.6, size, size * 0.4)

  // 旗杆
  ctx.strokeStyle = '#e8c98a'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(size * 0.34, size * 0.88)
  ctx.lineTo(size * 0.34, size * 0.16)
  ctx.stroke()

  // 旗面（朱红三角，带一点飘动）
  ctx.fillStyle = '#a5231d'
  ctx.beginPath()
  ctx.moveTo(size * 0.35, size * 0.18)
  ctx.quadraticCurveTo(size * 0.62, size * 0.2, size * 0.86, size * 0.3)
  ctx.quadraticCurveTo(size * 0.62, size * 0.42, size * 0.35, size * 0.42)
  ctx.closePath()
  ctx.fill()

  // 旗面高光
  ctx.strokeStyle = 'rgba(255, 214, 150, 0.5)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(size * 0.36, size * 0.2)
  ctx.quadraticCurveTo(size * 0.62, size * 0.22, size * 0.84, size * 0.31)
  ctx.stroke()

  const tex = new CanvasTexture(canvas)
  tex.anisotropy = 4
  tex.generateMipmaps = false
  tex.minFilter = 1006 // LinearFilter

  const back = new Sprite(
    new SpriteMaterial({
      map: radialTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0)'),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  )
  back.renderOrder = 8

  const flag = new Sprite(
    new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  )
  flag.renderOrder = 10

  group.add(flag)

  return {
    mesh: group,
    update(time, scale) {
      const sway = Math.sin(time * 2.1) * 0.10 + Math.sin(time * 3.7) * 0.04
      flag.scale.set(scale * 1.25, scale * 1.25, 1)
      flag.material.rotation = sway * 0.35
      back.scale.set(scale * 1.25, scale * 1.25, 1)
      back.material.opacity = 0.28
    },
    dispose() {
      tex.dispose()
      flag.material.dispose()
      back.material.dispose()
    },
  }
}
