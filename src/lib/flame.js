/**
 * 火焰头：一个始终朝向相机的平面，片元里用 fbm 噪声卷出焰舌。
 *
 * 为什么不用贴图序列：帧序列会露出"循环播放"的规律感；
 * 程序化火焰每帧都不一样，且可以沿前进方向拉长。
 */
import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three'

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uStretch;   // 沿前进方向拉长
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // 把 uv 压成"焰舌"的坐标：底部宽、顶部收窄
    vec2 uv = vUv;
    uv.x = (uv.x - 0.5) / uStretch + 0.5;
    float y = uv.y;

    // 上卷：噪声随时间向上流动
    float n = fbm(vec2(uv.x * 3.4, y * 4.0 - uTime * 2.2));
    float n2 = fbm(vec2(uv.x * 7.0 + 3.1, y * 8.0 - uTime * 3.4));

    // 焰舌形状：底部 0.06 处最宽，向上收
    float width = 0.52 * (1.0 - y * 0.82);
    float dx = abs(uv.x - 0.5);
    float body = smoothstep(width, width * 0.55, dx);
    body *= smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.55, y);

    // 边缘被噪声侵蚀，撕出火舌
    body *= smoothstep(0.18, 0.62, n + 0.35 * body);

    // 颜色：白心 → 橙 → 暗红
    vec3 core = vec3(1.0, 0.96, 0.86);
    vec3 mid = vec3(1.0, 0.55, 0.16);
    vec3 edge = vec3(0.72, 0.16, 0.06);
    float t = smoothstep(0.0, 0.75, body);
    vec3 col = mix(edge, mid, t);
    col = mix(col, core, smoothstep(0.62, 0.98, body) * 0.5);

    // 亮度抖动
    float flicker = 0.86 + 0.14 * sin(uTime * 17.0 + n2 * 6.0);
    float alpha = body * uIntensity * flicker;

    gl_FragColor = vec4(col * (0.8 + 0.35 * body), alpha * 0.9);
  }
`

export function createFlame() {
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStretch: { value: 1.6 },
      uIntensity: { value: 0.45 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  })

  const mesh = new Mesh(new PlaneGeometry(1, 1), material)
  mesh.frustumCulled = false
  mesh.visible = false

  return {
    mesh,
    /** size: 世界单位下的高度；caller 负责按相机距离换算成屏幕 40~60px */
    update(time, size, intensity = 1) {
      material.uniforms.uTime.value = time
      material.uniforms.uIntensity.value = intensity
      mesh.scale.set(size * 1.6, size, 1)
      if (_quat) mesh.quaternion.copy(_quat)
    },
    setDirection() {},
    dispose() {
      mesh.geometry.dispose()
      material.dispose()
    },
  }
}

// 占位：调用方每帧把相机四元数写进来（保持 billboard）
let _quat = null
export function bindCameraQuaternion(q) {
  _quat = q
}
function cameraQuat() {
  return _quat
}
