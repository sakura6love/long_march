<script setup>
/**
 * App —— 只做四件事：
 *   1. 装地球、装面板；
 *   2. 记"哪些站被点亮了"，并把"火线该不该烧"算出来；
 *   3. 事件暂停时把事件卡推上来；
 *   4. 把"点空白"的两种含义分清楚（继续烧 / 关面板）。
 *
 * 火的规则（唯一一条）：
 *   以瑞金为起点，连续点亮的站才有火线；中间缺一个站，火就停在那儿。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EarthGlobe from './components/EarthGlobe.vue'
import DetailPanel from './components/DetailPanel.vue'
import AskPanel from './components/AskPanel.vue'
import EventScene from './components/EventScene.vue'
import longMarchNodes from './data.js'
import { readLitIds, lightUp } from './lib/api.js'

const globeRef = ref(null)
const activeIndex = ref(-1)
const activeNode = computed(() =>
  activeIndex.value >= 0 ? longMarchNodes[activeIndex.value] : null,
)

// —— 已点亮的站（本机持久化那一份仍走 api.js） ——
const litIds = ref([])
const activeLit = computed(() => (activeNode.value ? litIds.value.includes(activeNode.value.id) : false))

const litSet = computed(() => new Set(litIds.value.map((id) => indexOfId(id))))
function indexOfId(id) {
  return longMarchNodes.findIndex((n) => n.id === id)
}

/**
 * 火线走到第几段：从瑞金开始数，连续点亮的站的个数。
 * chainEnd = 3 表示 瑞金/于都/湘江 亮着，火线烧到第 2 段（于都→湘江）。
 */
const chainEnd = computed(() => {
  let k = 0
  while (k < longMarchNodes.length && litSet.value.has(k)) k += 1
  return k
})

const burning = ref(null) // 正在燃烧的段号，null = 没在烧
const pausedEvent = ref(null) // 停住的事件（null = 没停）
const showingEvent = ref(null) // 事件卡正在展示哪一条

function handleLightUp(id) {
  litIds.value = lightUp(id)
}

/** 地球把点中的节点抛上来：开面板 + 点亮 + 可能点火。 */
function handleSelect(node) {
  // 事件暂停时点标签 = 跳过这个事件
  if (pausedEvent.value) skipEvent()

  const index = longMarchNodes.findIndex((item) => item.id === node.id)
  if (index >= 0) {
    activeIndex.value = index
    igniteIfChainGrew(index)
  }
}

/** 点亮第 index 站；如果它让"连续前缀"变长，就把新增的段从头到尾烧过去。 */
function igniteIfChainGrew(index) {
  if (litIds.value.includes(longMarchNodes[index].id)) return

  const before = chainEnd.value
  litIds.value = [...litIds.value, longMarchNodes[index].id]
  const after = chainEnd.value
  if (after <= before) return

  // 段号：before 站亮着 → 已烧 0..before-2 段；现在烧 before-1 .. after-2
  const from = Math.max(0, before - 1)
  const to = after - 2
  if (to < from) return

  burning.value = { from, to }
  globeRef.value?.ignite(from, to, {
    onEvent(event) {
      pausedEvent.value = event
      showingEvent.value = event
      activeIndex.value = -1
    },
    onSegment() {},
    onDone() {
      burning.value = null
    },
  })
}

function closePanel() {
  activeIndex.value = -1
}

function navigate(step) {
  if (activeIndex.value < 0) return
  const next = (activeIndex.value + step + longMarchNodes.length) % longMarchNodes.length
  globeRef.value?.focusNode(longMarchNodes[next])
}

/** 事件暂停中：继续烧 */
function skipEvent() {
  if (!pausedEvent.value) return
  pausedEvent.value = null
  showingEvent.value = null
  globeRef.value?.resumeFire()
}

/** 燃烧中：快进到本段终点（事件照常弹） */
function skipBurn() {
  globeRef.value?.skipFire()
}

/** 点空白：只有两种含义 */
function handleTap() {
  if (pausedEvent.value) {
    skipEvent()
    return
  }
  if (activeIndex.value >= 0) closePanel()
}

const hint = computed(() => {
  if (pausedEvent.value) return '点击空白 · 继续'
  if (activeIndex.value >= 0) return '点击空白 · 关闭'
  if (chainEnd.value >= longMarchNodes.length) return '长征走完了 · 双击复位'
  const next = longMarchNodes[chainEnd.value]
  return next ? `点击光点 · ${next.name}` : ''
})

const backdropImage = computed(() => (showingEvent.value ? showingEvent.value.image : ''))
const globeDimmed = computed(() => !!showingEvent.value)

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (pausedEvent.value) {
    skipEvent()
    return
  }
  closePanel()
}

onMounted(() => {
  const saved = readLitIds()
  litIds.value = saved
  window.addEventListener('keydown', handleKeydown)

  if (import.meta.env.DEV) {
    window.__march = {
      lit: litIds,
      chainEnd,
      burning,
      pausedEvent,
      igniteIfChainGrew,
    }
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="main-container">
    <EarthGlobe
      ref="globeRef"
      :lit-ids="litIds"
      :backdrop="backdropImage"
      :dim="globeDimmed"
      :story-active="!!activeNode || !!pausedEvent"
      @select="handleSelect"
      @tap="handleTap"
      @reset="closePanel"
    />

    <DetailPanel
      :node="activeNode"
      :order="activeIndex + 1"
      :total="longMarchNodes.length"
      :lit="activeLit"
      :lit-count="litIds.length"
      @close="closePanel"
      @navigate="navigate"
      @light-up="handleLightUp"
    />

    <EventScene :event="showingEvent" />

    <p v-if="hint" class="story-hint" aria-hidden="true">{{ hint }}</p>

    <button
      v-if="burning && !pausedEvent"
      class="skip-burn"
      type="button"
      @click.stop="skipBurn"
    >
      跳过
    </button>

    <AskPanel />
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #0b0f19;
  overflow: hidden;
}

.main-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.story-hint {
  position: fixed;
  left: 50%;
  bottom: 4.5vh;
  z-index: 8;
  margin: 0;
  transform: translateX(-50%);
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 11px;
  letter-spacing: 0.26em;
  color: rgba(243, 241, 230, 0.42);
  pointer-events: none;
  animation: story-hint-breathe 2.8s ease-in-out infinite;
}

@keyframes story-hint-breathe {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.skip-burn {
  position: fixed;
  right: 8vw;
  bottom: 4.5vh;
  z-index: 8;
  padding: 0;
  border: 0;
  background: none;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 11px;
  letter-spacing: 0.22em;
  color: rgba(243, 241, 230, 0.4);
  cursor: pointer;
  transition: color 0.3s ease;
}

.skip-burn:hover {
  color: #e9e2d4;
}
</style>
