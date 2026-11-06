/**
 * 火星粒子池：InstancedMesh（一次 draw call），每颗独立尺寸、颜色、寿命。
 *
 * 为什么不用 Points：Points 的尺寸是全局的，加色叠在亮地表上会被吃掉，
 * 也无法单独控制某一颗的透明度。
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'

function dotTexture() {
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,244,220,1)')
  g.addColorStop(0.35, 'rgba(255,168,96,0.85)')
  g.addColorStop(1, 'rgba(120,30,16,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new CanvasTexture(c)
}

export function createSparks(count = 160) {
  const geo = new PlaneGeometry(1, 1)
  const mat = new MeshBasicMaterial({
    map: dotTexture(),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const mesh = new InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false
  mesh.count = count

  const zero = new Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < count; i += 1) mesh.setMatrixAt(i, zero)
  mesh.instanceMatrix.needsUpdate = true

  const parts = Array.from({ length: count }, () => ({
    life: 0,
    max: 1,
    pos: new Vector3(),
    vel: new Vector3(),
    size: 1,
  }))

  const m = new Matrix4()
  const q = new Quaternion()
  const scl = new Vector3()
  const tmp = new Vector3()
  const hot = new Color('#fff2c8')
  const mid = new Color('#ff7a2a')
  const cold = new Color('#5a1208')
  const col = new Color()
  let cursor = 0
  let visible = true

  return {
    mesh,
    setVisible(v) {
      visible = v
      mesh.visible = v
    },
    /** 在 pos 处沿 dir 方向撒一簇火星 */
    spawn(pos, dir, n = 6, cameraQuat = null) {
      for (let k = 0; k < n; k += 1) {
        const p = parts[cursor]
        cursor = (cursor + 1) % count
        p.life = 0.7 + Math.random() * 0.7
        p.max = p.life
        p.size = 1.6 + Math.random() * 1.8
        p.pos.copy(pos).addScaledVector(dir, 0.05 * Math.random())
        p.vel.set(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
        )
        p.vel.addScaledVector(dir, 0.25 + Math.random() * 0.35)
        p.quat = cameraQuat
      }
    },
    update(dt, cameraQuat) {
      if (!visible) return
      for (let i = 0; i < count; i += 1) {
        const p = parts[i]
        if (p.life <= 0) {
          mesh.setMatrixAt(i, zero)
          continue
        }
        p.life -= dt
        // 重力朝球心
        tmp.copy(p.pos).normalize().multiplyScalar(-0.9 * dt)
        p.vel.add(tmp)
        p.pos.addScaledVector(p.vel, dt)

        const k = Math.max(0, p.life / p.max) // 1 → 0
        scl.setScalar(p.size * (0.35 + 0.65 * k))
        q.copy(cameraQuat || new Quaternion())
        m.compose(p.pos, q, scl)
        mesh.setMatrixAt(i, m)

        col.copy(hot).lerp(mid, 1 - k)
        if (k < 0.35) col.lerp(cold, (0.35 - k) / 0.35)
        col.multiplyScalar(0.4 + 0.6 * k)
        mesh.setColorAt(i, col)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
    dispose() {
      geo.dispose()
      mat.map?.dispose()
      mat.dispose()
    },
  }
}
