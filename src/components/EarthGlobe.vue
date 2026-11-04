<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import Globe from 'globe.gl'
import { AmbientLight, DirectionalLight } from 'three'
import longMarchNodes from '../data.js'

const emit = defineEmits(['select'])

// 只让 DOM 容器参与 Vue 响应式；WebGL 实例使用 shallowRef，避免深度代理。
const globeContainer = ref(null)
const globe = shallowRef(null)

let resizeObserver = null
let rotationTimer = null

function resizeGlobe() {
  if (!globe.value || !globeContainer.value) return

  const { clientWidth, clientHeight } = globeContainer.value
  if (clientWidth > 0 && clientHeight > 0) {
    globe.value.width(clientWidth).height(clientHeight)
  }
}

function handleNodeSelect(pointData) {
  if (!globe.value) return

  const controls = globe.value.controls()
  controls.autoRotate = false
  window.clearTimeout(rotationTimer)

  // 低轨镜头：近距离俯瞰中国区域，保留地球弧面和地平线。
  globe.value.pointOfView(
    {
      lat: pointData.lat,
      lng: pointData.lng,
      altitude: 0.5,
    },
    1500,
  )

  emit('select', pointData)

  rotationTimer = window.setTimeout(() => {
    if (globe.value) {
      globe.value.controls().autoRotate = true
    }
  }, 4200)
}

/**
 * 外层元素严格保持 0x0。
 * CSS2DRenderer 会将这个零尺寸元素的原点投影到经纬度位置，
 * 文字面板、引导线和发光点全部从该原点展开，不会被面板宽度拉偏。
 */
function createChineseLabel(pointData) {
  const anchor = document.createElement('button')
  anchor.type = 'button'
  anchor.className = 'march-label-anchor'
  anchor.setAttribute('aria-label', `查看${pointData.name}历史节点`)
  anchor.innerHTML = `
    <span class="march-label-beam" aria-hidden="true"></span>
    <span class="march-label-node" aria-hidden="true"></span>
    <span class="march-label-card">
      <span class="march-label-code">${pointData.id.toUpperCase()}</span>
      <strong>${pointData.name}</strong>
      <small>${pointData.date}</small>
    </span>
  `

  anchor.addEventListener('click', (event) => {
    event.stopPropagation()
    handleNodeSelect(pointData)
  })

  return anchor
}

onMounted(() => {
  if (!globeContainer.value) return

  globe.value = Globe()(globeContainer.value)
    .backgroundColor('rgba(0, 0, 0, 0)')
    .globeImageUrl(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    )
    .bumpImageUrl('/earth-topology.png')
    .showAtmosphere(true)
    .atmosphereColor('#4b7eb3')
    .atmosphereAltitude(0.13)
    // 保持原有所有节点的经纬度与标签高度不变。
    .htmlElementsData(longMarchNodes)
    .htmlLat((point) => point.lat)
    .htmlLng((point) => point.lng)
    .htmlAltitude(0.01)
    .htmlTransitionDuration(0)
    .htmlElement(createChineseLabel)

  const scene = globe.value.scene()

  // 极低环境光压住整体亮度，再用低位侧光刻出山脉和地形阴影。
  scene.add(new AmbientLight(0x536273, 0.24))

  const terrainLight = new DirectionalLight(0xffdfad, 2.15)
  terrainLight.position.set(-180, 34, 125)
  scene.add(terrainLight)

  const rimLight = new DirectionalLight(0x6f91b8, 0.35)
  rimLight.position.set(120, 18, -160)
  scene.add(rimLight)

  const globeMaterial = globe.value.globeMaterial()
  globeMaterial.color.set('#ffffff')
  globeMaterial.bumpScale = 0.24
  globeMaterial.roughness = 0.88
  globeMaterial.metalness = 0.03
  globeMaterial.emissive.set('#111b27')
  globeMaterial.emissiveIntensity = 0.06
  globeMaterial.needsUpdate = true

  // 低地轨道空间站式俯瞰：中国位于镜头中心，地球弧面占据下半屏。
  globe.value.pointOfView(
    {
      lat: 34,
      lng: 105,
      altitude: 0.72,
    },
    0,
  )

  const controls = globe.value.controls()
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.08
  controls.enableZoom = true
  controls.minDistance = 101
  controls.maxDistance = 180
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.07

  resizeGlobe()
  resizeObserver = new ResizeObserver(resizeGlobe)
  resizeObserver.observe(globeContainer.value)
})

onBeforeUnmount(() => {
  window.clearTimeout(rotationTimer)
  resizeObserver?.disconnect()
  resizeObserver = null

  if (globe.value) {
    globe.value.controls().dispose()
    globe.value._destructor()
    globe.value = null
  }
})
</script>

<template>
  <div class="horizon-frame" aria-label="长征路线低地轨道空间站视角">
    <div
      ref="globeContainer"
      class="earth-globe"
      aria-label="长征路线数字地球，显示瑞金、遵义等历史节点"
    ></div>
    <div class="orbital-readout" aria-hidden="true">
      <span class="readout-dot"></span>
      <span>LOW EARTH ORBIT / CN-ROUTE</span>
    </div>
  </div>
</template>

<style scoped>
.horizon-frame {
  position: relative;
  width: 100vw;
  height: 100vh;
  min-height: 360px;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(ellipse at 50% 77%, rgba(71, 102, 126, 0.3), transparent 49%),
    linear-gradient(180deg, #070b13 0%, #0c1520 58%, #16222c 100%);
}

.horizon-frame::before {
  position: absolute;
  z-index: 3;
  right: 0;
  bottom: 17%;
  left: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(196, 163, 90, 0.18) 18%,
    rgba(224, 189, 114, 0.78) 50%,
    rgba(196, 163, 90, 0.18) 82%,
    transparent 100%
  );
  box-shadow: 0 0 28px rgba(196, 163, 90, 0.42);
  content: '';
  pointer-events: none;
}

.horizon-frame::after {
  position: absolute;
  z-index: 4;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(7, 11, 19, 0.48), transparent 24%, transparent 70%, rgba(7, 11, 19, 0.5)),
    radial-gradient(ellipse at 50% 74%, transparent 38%, rgba(3, 6, 11, 0.52) 100%);
  content: '';
  pointer-events: none;
}

/* 解除此前的下沉偏移：画布本身严格覆盖全屏。 */
.earth-globe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: visible;
}

:deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.orbital-readout {
  position: absolute;
  z-index: 6;
  top: 28px;
  left: 34px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgba(243, 241, 230, 0.62);
  font: 10px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.14em;
  pointer-events: none;
}

.readout-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c4a35a;
  box-shadow: 0 0 12px #c4a35a;
}

:deep(.march-label-anchor) {
  position: relative;
  display: block;
  width: 0;
  height: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
}

:deep(.march-label-node) {
  position: absolute;
  top: 0;
  left: 0;
  width: 9px;
  height: 9px;
  border: 1px solid #f8df9c;
  border-radius: 50%;
  background: #c4a35a;
  box-shadow:
    0 0 0 3px rgba(196, 163, 90, 0.18),
    0 0 18px rgba(224, 189, 114, 0.95);
  transform: translate(-50%, -50%);
}

:deep(.march-label-beam) {
  position: absolute;
  top: 0;
  left: 0;
  width: 30px;
  height: 1px;
  background: linear-gradient(90deg, #f3d48c, rgba(196, 163, 90, 0.2));
  box-shadow: 0 0 8px rgba(224, 189, 114, 0.8);
  transform: translate(3px, -50%);
  transform-origin: left center;
}

:deep(.march-label-card) {
  position: absolute;
  top: 0;
  left: 30px;
  display: grid;
  min-width: 92px;
  padding: 7px 10px 8px;
  border: 1px solid rgba(224, 189, 114, 0.56);
  border-left: 2px solid #c4a35a;
  border-radius: 1px 5px 5px 1px;
  background:
    linear-gradient(135deg, rgba(46, 52, 56, 0.92), rgba(11, 18, 26, 0.86)),
    radial-gradient(circle at 0 0, rgba(224, 189, 114, 0.18), transparent 55%);
  box-shadow:
    8px 8px 0 rgba(5, 9, 14, 0.42),
    0 5px 18px rgba(0, 0, 0, 0.32),
    inset 0 1px rgba(255, 255, 255, 0.11);
  color: #f3f1e6;
  font-family: 'Microsoft YaHei', 'Noto Sans CJK SC', 'PingFang SC', sans-serif;
  text-align: left;
  transform: translateY(-50%);
  transition:
    background 0.45s cubic-bezier(0.25, 1, 0.5, 1),
    border-color 0.45s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.45s cubic-bezier(0.25, 1, 0.5, 1);
}

:deep(.march-label-code) {
  color: #c4a35a;
  font: 8px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.12em;
}

:deep(.march-label-card strong) {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

:deep(.march-label-card small) {
  margin-top: 3px;
  color: rgba(243, 241, 230, 0.55);
  font: 9px/1.2 'Space Mono', ui-monospace, monospace;
}

:deep(.march-label-anchor:hover .march-label-card),
:deep(.march-label-anchor:focus-visible .march-label-card) {
  border-color: #f3d48c;
  background:
    linear-gradient(135deg, rgba(74, 61, 38, 0.96), rgba(17, 24, 29, 0.94)),
    radial-gradient(circle at 0 0, rgba(224, 189, 114, 0.26), transparent 55%);
  box-shadow:
    10px 10px 0 rgba(5, 9, 14, 0.46),
    0 7px 24px rgba(196, 163, 90, 0.2),
    inset 0 1px rgba(255, 255, 255, 0.15);
}

@media (max-width: 768px) {
  .orbital-readout {
    top: 20px;
    left: 20px;
    font-size: 8px;
  }

  :deep(.march-label-card) {
    min-width: 76px;
    padding: 5px 7px 6px;
  }

  :deep(.march-label-card strong) {
    font-size: 12px;
  }

  :deep(.march-label-beam) {
    width: 18px;
  }

  :deep(.march-label-card) {
    left: 18px;
  }
}
</style>
