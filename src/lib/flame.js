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

  const back = new Sprite(
    new SpriteMaterial({
      map: radialTexture('rgba(0,0,0,0.78)', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0)'),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  )
  back.renderOrder = 8

  const tex = new TextureLoader().load(`${import.meta.env.BASE_URL}flame.png?v=7`)

  const outer = new Sprite(
    new SpriteMaterial({ map: tex, color: 0xff6a1a, transparent: true, depthWrite: false, depthTest: false }),
  )
  outer.renderOrder = 9

  const mid = new Sprite(
    new SpriteMaterial({ map: tex, color: 0xffb257, transparent: true, depthWrite: false, depthTest: false, blending: 2 }),
  )
  mid.renderOrder = 10

  const core = new Sprite(
    new SpriteMaterial({
      map: radialTexture('rgba(255,246,214,0.95)', 'rgba(255,176,64,0.55)', 'rgba(255,110,20,0)'),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: 2,
    }),
  )
  core.renderOrder = 11

  group.add(back, outer, mid, core)

  return {
    mesh: group,
    update(time, size) {
      const f1 = Math.sin(time * 13.7)
      const f2 = Math.sin(time * 23.1 + 1.7)
      const f3 = Math.sin(time * 31.3 + 0.4)
      const k = 1 + f1 * 0.06 + f2 * 0.05
      outer.scale.set(size * 0.95 * k, size * 1.55 * k, 1)
      mid.scale.set(size * 0.66 * k, size * 1.1 * k, 1)
      core.scale.set(size * 0.42 * (1 + f3 * 0.12), size * 0.56 * (1 + f3 * 0.12), 1)
      core.position.y = size * 0.16
      back.scale.set(size * 1.35, size * 1.6, 1)
      outer.material.opacity = 0.95
      mid.material.opacity = 0.75 + f1 * 0.08
      core.material.opacity = 0.8 + f3 * 0.12
    },
    dispose() {
      tex.dispose()
      outer.material.dispose()
      mid.material.dispose()
      core.material.dispose()
    },
  }
}
