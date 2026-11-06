/**
 * 火焰头：一张 512px 的焰形贴图，靠缩放抖动与透明度呼吸"活"起来。
 * （图集方案在球面上会被压扁、且小尺寸下颜色被平均掉，弃用。）
 */
import { Sprite, SpriteMaterial, TextureLoader } from 'three'

export function createFlame() {
  const tex = new TextureLoader().load(`${import.meta.env.BASE_URL}flame.png`)
  const material = new SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
  const sprite = new Sprite(material)
  sprite.frustumCulled = false
  sprite.renderOrder = 9
  sprite.visible = false

  return {
    mesh: sprite,
    update(time, size) {
      // 两个不同频率的抖动叠在一起，避免"匀速呼吸"的规律感
      const f1 = Math.sin(time * 13.7)
      const f2 = Math.sin(time * 23.1 + 1.7)
      const k = 1 + f1 * 0.05 + f2 * 0.04
      sprite.scale.set(size * 0.82 * k, size * 1.28 * k, 1)
      material.opacity = 0.88 + f1 * 0.06
    },
    dispose() {
      tex.dispose()
      material.dispose()
    },
  }
}
