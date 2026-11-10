import {
  AdditiveBlending,
  BackSide,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
} from 'three'

export function clampProgress(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0
}

/** A quiet beginning, a warmer middle, then a broad golden horizon. */
export function dawnProfile(progress) {
  const p = clampProgress(progress)
  const warmth = p * p * (3 - 2 * p)
  return {
    warmth,
    innerWidth: 0.032 + 0.024 * warmth,
    outerWidth: 0.12 + 0.10 * warmth,
    innerStrength: 0.12 + 0.18 * warmth,
    outerStrength: 0.035 + 0.105 * warmth,
    hemisphere: 0.55 + 0.13 * warmth,
    ambient: 0.12 + 0.04 * warmth,
    terrain: 3.05 + 0.20 * warmth,
    rim: 0.26 + 0.46 * warmth,
  }
}

/** Time-based easing behaves the same at 30, 60 and 120 fps. */
export function approachLight(current, target, seconds, timeConstant) {
  const delta = Math.max(0, Math.min(0.1, seconds))
  const next = current + (target - current) * (1 - Math.exp(-delta / timeConstant))
  return Math.abs(next - target) < 0.0001 ? target : next
}

const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vViewNormal;

void main() {
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vViewNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform float uRadius;
uniform float uWidth;
uniform float uStrength;
uniform vec3 uColor;
varying vec3 vWorldPosition;
varying vec3 vViewNormal;

void main() {
  // The globe and both shells share the scene origin. The camera ray's
  // closest distance to that origin gives a stable, perspective-correct rim.
  vec3 ray = normalize(vWorldPosition - cameraPosition);
  float distanceToCenter = length(cross(cameraPosition, ray));
  // Let the actual globe depth occlude this back-facing shell. An ideal-radius
  // cutout leaves a dark gap beside the globe's inscribed polygon silhouette.
  float height = max(0.0, (distanceToCenter - uRadius) / (uRadius * uWidth));
  float falloff = exp(-3.2 * height) * (1.0 - smoothstep(0.65, 1.0, height));
  // A broad upper glow with a quiet lower limb, rather than a uniform ring.
  vec3 normal = normalize(vViewNormal);
  float upperRim = 0.15 + 0.85 * smoothstep(-0.35, 0.8, normal.y + normal.x * 0.25);
  float alpha = clamp(falloff * upperRim * uStrength, 0.0, 1.0);

  gl_FragColor = vec4(uColor, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

/** Two lightweight shells, built once. Progress only changes uniforms/scale. */
export function createDawnAtmosphere(radius) {
  const group = new Group()
  group.name = 'long-march-dawn'
  group.visible = false
  const geometry = new SphereGeometry(radius, 128, 64)
  const innerStart = new Color('#c6a979')
  const innerEnd = new Color('#ffe9bc')
  const outerStart = new Color('#9f8059')
  const outerEnd = new Color('#e8be80')

  function makeShell(name) {
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uRadius: { value: radius },
        uWidth: { value: 0.1 },
        uStrength: { value: 0 },
        uColor: { value: new Color() },
      },
      transparent: true,
      depthWrite: false,
      // Required: the opaque globe supplies the exact inner silhouette.
      depthTest: true,
      side: BackSide,
      blending: AdditiveBlending,
    })
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.renderOrder = 1
    group.add(mesh)
    return mesh
  }

  const outer = makeShell('dawn-soft-halo')
  const inner = makeShell('dawn-horizon-edge')

  return {
    group,
    update(profile, dim = 0, appearance = 1) {
      // History scenes retain their own image/reading contrast.
      const visibility = (1 - 0.88 * clampProgress(dim)) * clampProgress(appearance)
      group.visible = visibility > 0.0001
      for (const [mesh, width, strength, from, to] of [
        [inner, profile.innerWidth, profile.innerStrength, innerStart, innerEnd],
        [outer, profile.outerWidth, profile.outerStrength, outerStart, outerEnd],
      ]) {
        mesh.scale.setScalar(1 + width)
        mesh.material.uniforms.uWidth.value = width
        mesh.material.uniforms.uStrength.value = strength * visibility
        mesh.material.uniforms.uColor.value.lerpColors(from, to, profile.warmth)
      }
    },
    dispose() {
      group.removeFromParent()
      geometry.dispose()
      inner.material.dispose()
      outer.material.dispose()
    },
  }
}
