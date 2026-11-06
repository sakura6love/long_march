<script setup>
/**
 * App —— 装地球、装面板、把"选中了谁"这件事在两者之间传话。
 * 另外负责"长征叙事"的播放状态机：每一次点击，只往前走一步。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EarthGlobe from './components/EarthGlobe.vue'
import DetailPanel from './components/DetailPanel.vue'
import AskPanel from './components/AskPanel.vue'
import EventScene from './components/EventScene.vue'
import longMarchNodes from './data.js'
import { readLitIds, lightUp } from './lib/api.js'
import { STORY_EVENTS } from './lib/story.js'

const globeRef = ref(null)
// -1 表示"没有选中任何节点"，面板随之收起
const activeIndex = ref(-1)

const activeNode = computed(() =>
  activeIndex.value >= 0 ? longMarchNodes[activeIndex.value] : null,
)

// 已点亮的站点 id：存在本机，刷新后还在
const litIds = ref([])
const activeLit = computed(() => (activeNode.value ? litIds.value.includes(activeNode.value.id) : false))

function handleLightUp(id) {
  litIds.value = lightUp(id)
}

/** 地球把点中的节点抛上来，这里换算成序号。 */
function handleSelect(node) {
  const index = longMarchNodes.findIndex((item) => item.id === node.id)
  if (index >= 0) {
    activeIndex.value = index
    // 自由点击 = 直接把播放进度挪到这一站，不要再补播前面的事件。
    if (story.active) {
      story.index = index
      story.lastEventAt = index
      closeEvent()
      story.phase = 'prompt'
    }
  }
}

function closePanel() {
  activeIndex.value = -1
}

/** 面板里的 ← → ：按时间顺序在路线上一站一站走。 */
function navigate(step) {
  if (activeIndex.value < 0) return
  const next = (activeIndex.value + step + longMarchNodes.length) % longMarchNodes.length
  globeRef.value?.focusNode(longMarchNodes[next])
}

/* ------------------------------------------------------------------ *
 * 长征叙事：一次点击走一步
 *   idle → prompt（等点击）→ travel（镜头飞过去、火线接上）
 *        → event（事件卡，等点击）→ prompt → … → done
 * ------------------------------------------------------------------ */
const story = ref({
  active: false,
  phase: 'idle', // idle | prompt | travel | event | done
  index: 0, // 已经走到第几站
  lastEventAt: -1, // 避免同一事件重复播
  event: null,
})

const routeProgress = computed(() => (story.value.active ? story.value.index : -1))

const storyLitIds = computed(() => {
  if (!story.value.active) return litIds.value
  return longMarchNodes.slice(0, story.value.index + 1).map((node) => node.id)
})

const backdropImage = computed(() => (story.value.event ? story.value.event.image : ''))
const globeDimmed = computed(() => story.value.phase === 'event')

const storyHint = computed(() => {
  const s = story.value
  if (!s.active) return ''
  if (s.phase === 'done') return '长征走完了 · 双击复位'
  if (s.phase === 'prompt') {
    return s.index === 0
      ? '点击出发 · 瑞金'
      : `点击继续 · 下一站 ${longMarchNodes[s.index + 1]?.name ?? ''}`
  }
  if (s.phase === 'travel') return '火线正在往前烧…'
  return ''
})

function startStory() {
  if (story.value.active) return
  closePanel()
  story.value = { active: true, phase: 'prompt', index: 0, lastEventAt: -1, event: null }
}

function advance() {
  const s = story.value
  if (s.index >= longMarchNodes.length - 1) {
    s.phase = 'done'
    return
  }

  const from = s.index
  const next = from + 1
  s.phase = 'travel'
  closePanel()
  globeRef.value?.focusNode(longMarchNodes[next], { silent: true })

  window.setTimeout(() => {
    if (!story.value.active) return
    s.index = next
    const candidates = STORY_EVENTS.filter((e) => e.at > s.lastEventAt && e.at <= next)
    if (candidates.length) {
      const event = candidates[0]
      s.event = event
      s.lastEventAt = event.at
      s.phase = 'event'
    } else {
      s.phase = next >= longMarchNodes.length - 1 ? 'done' : 'prompt'
    }
  }, 1700)
}

function closeEvent() {
  story.value.event = null
  if (story.value.active) {
    story.value.phase = story.value.index >= longMarchNodes.length - 1 ? 'done' : 'prompt'
  }
}

function skipEvent() {
  const event = story.value.event
  if (event) story.value.lastEventAt = event.at
  closeEvent()
}

function quitStory() {
  story.value.active = false
  story.value.phase = 'idle'
  story.value.event = null
  story.value.index = longMarchNodes.length - 1
}

/** 点画面 = 继续；正在飞的时候点了没用（等它落稳）。 */
function handleTap() {
  const s = story.value
  if (!s.active) return
  if (s.phase === 'event') {
    closeEvent()
    return
  }
  if (s.phase === 'prompt') advance()
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (story.value.event) {
    skipEvent()
    return
  }
  if (story.value.active) {
    quitStory()
    return
  }
  closePanel()
}

let storyTimer = 0

onMounted(() => {
  litIds.value = readLitIds()
  window.addEventListener('keydown', handleKeydown)
  // 开场动画约 5.2s；等它落稳，再把第一站推到用户面前。
  storyTimer = window.setTimeout(() => {
    if (activeIndex.value < 0 && !story.value.active) startStory()
  }, 7200)

  if (import.meta.env.DEV) {
    window.__marchStory = story
    window.__marchAdvance = advance
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.clearTimeout(storyTimer)
})
</script>

<template>
  <div class="main-container">
    <!-- 这里就是把造好的地球仪放进网页 -->
    <EarthGlobe
      ref="globeRef"
      :lit-ids="storyLitIds"
      :route-progress="routeProgress"
      :backdrop="backdropImage"
      :dim="globeDimmed"
      :story-active="story.active"
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

    <EventScene
      :event="story.event"
      @skip="skipEvent"
      @quit="quitStory"
    />

    <p v-if="storyHint" class="story-hint" aria-hidden="true">{{ storyHint }}</p>

    <AskPanel />
  </div>
</template>

<style>
/* 这一步极其致命！必须强制网页占满全屏，否则地球高度是0，就会看不见 */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #0b0f19; /* 深空背景色 */
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
</style>
