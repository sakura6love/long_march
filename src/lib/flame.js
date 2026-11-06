/**
 * 火焰头：贴图焰舌 + 一层暗底。
 * 暗底不是装饰：火焰压在明亮地表（黄土高原、雪线）时，没有暗底就读不出来。
 */
import { CanvasTexture, Group, Sprite, SpriteMaterial, TextureLoader } from 'three'

function backingTexture() {
  const s = 256
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(0, 0, 0, 0.72)')
  g.addColorStop(0.55, 'rgba(0, 0, 0, 0.3)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new CanvasTexture(c)
}

export function createFlame() {
  const group = new Group()
  group.visible = false

  const back = new Sprite(
    new SpriteMaterial({
      map: backingTexture(),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  )
  back.renderOrder = 8

  const tex = new TextureLoader().load(`${import.meta.env.BASE_URL}flame.png?v=6`)
  const material = new SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
  const sprite = new Sprite(material)
  sprite.renderOrder = 9

  group.add(back, sprite)

  return {
    mesh: group,
    update(time, size) {
      const f1 = Math.sin(time * 13.7)
      const f2 = Math.sin(time * 23.1 + 1.7)
      const k = 1 + f1 * 0.05 + f2 * 0.04
      sprite.scale.set(size * 1.0 * k, size * 1.3 * k, 1)
      back.scale.set(size * 1.5 * k, size * 1.6 * k, 1)
      material.opacity = 0.9 + f1 * 0.06
    },
    dispose() {
      tex.dispose()
      material.dispose()
    },
  }
}

