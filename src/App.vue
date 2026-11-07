<script setup>
/**
 * 五幕：序章 → 俯瞰 → 展签 → 设置 → 终章。
 *
 * 火只有一条：从瑞金起算，连续点亮的站才连成线；
 * 中间缺一站，火就停在那儿，补上缺口后一次烧过去。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EarthGlobe from './components/EarthGlobe.vue'
import DetailPanel from './components/DetailPanel.vue'
import AskPanel from './components/AskPanel.vue'
import EventScene from './components/EventScene.vue'
import StartScreen from './components/StartScreen.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import FinaleScreen from './components/FinaleScreen.vue'
import longMarchNodes from './data.js'
import ChapterCard from './components/ChapterCard.vue'
import EventRail from './components/EventRail.vue'
import { CHAPTERS } from './lib/chapters.js'
import { STORY_EVENTS } from './lib/story.js'
import { readLitIds, lightUp, clearProgress } from './lib/api.js'
import { isMuted, setMuted, startAudio, sfxIgnite, sfxPage, sfxTap } from './lib/audio.js'

const globeRef = ref(null)
const screen = ref('start') // start | overview | finale

// 三幕：start（序章）/ playing（播放中）/ free（自由浏览）/ finale（终章）
const mode = computed(() => {
  if (screen.value === 'start') return 'start'
  if (screen.value === 'finale') return 'finale'
  if (burning.value || pausedEvent.value || showingEvent.value || activeChapter.value) return 'playing'
  return 'free'
})
const settingsOpen = ref(false)
const settingsFrom = ref('start')
const reduced = ref(false)

const activeIndex = ref(-1)
const activeNode = computed(() =>
  activeIndex.value >= 0 ? longMarchNodes[activeIndex.value] : null,
)

const litIds = ref(readLitIds())
const activeLit = computed(() => (activeNode.value ? litIds.value.includes(activeNode.value.id) : false))

const indexOfId = (id) => longMarchNodes.findIndex((n) => n.id === id)
const litSet = computed(() => new Set(litIds.value.map(indexOfId)))

/** 连续前缀：从瑞金开始，连续点亮的站的个数。 */
const chainEnd = computed(() => {
  let k = 0
  while (k < longMarchNodes.length && litSet.value.has(k)) k += 1
  return k
})

const burning = ref(false)
const pausedEvent = ref(null)
const showingEvent = ref(null)
const seenEvents = ref([])

function openEventById(id) {
  const e = STORY_EVENTS.find((x) => x.id === id)
  if (!e) return
  activeIndex.value = -1
  pausedEvent.value = null
  showingEvent.value = e
}

const NEXT_LABEL = computed(() => longMarchNodes[chainEnd.value]?.name ?? '')
const canResume = computed(() => litIds.value.length > 0 && chainEnd.value > 0)

/* ---------------- 幕间 ---------------- */

function goOverview() {
  screen.value = 'overview'
  globeRef.value?.enterOverview()
  sfxPage()
}

function handleStart() {
  startAudio()
  litIds.value = []
  clearProgress()
  activeIndex.value = -1
  showingEvent.value = null
  pausedEvent.value = null
  globeRef.value?.clearFire()
  goOverview()
}

function handleResume() {
  activeIndex.value = -1
  goOverview()
}

function openSettings() {
  settingsFrom.value = screen.value
  settingsOpen.value = true
  sfxTap()
}

function closeSettings() {
  settingsOpen.value = false
  sfxPage()
  if (settingsFrom.value === 'start') screen.value = 'start'
  else screen.value = 'overview'
}

function restart() {
  clearProgress()
  litIds.value = []
  activeIndex.value = -1
  showingEvent.value = null
  pausedEvent.value = null
  settingsOpen.value = false
  screen.value = 'start'
  globeRef.value?.clearFire()
  globeRef.value?.leaveOverview()
  sfxPage()
}

function toggleMute() {
  setMuted(!isMuted())
}

function toggleMotion() {
  reduced.value = !reduced.value
  document.documentElement.classList.toggle('reduce-motion', reduced.value)
}

/* ---------------- 火 ---------------- */

function stationTimeOfAt(at) {
  const s = globeRef.value?.stationS || []
  if (!s.length) return 0
  const whole = Math.floor(at)
  const frac = at - whole
  const a = s[Math.min(s.length - 1, whole)]
  const b = s[Math.min(s.length - 1, whole + 1)]
  return a + (b - a) * frac
}

function handleSelect(node) {
  if (pausedEvent.value) closeEvent()

  const index = indexOfId(node.id)
  if (index < 0) return
  activeIndex.value = index

  if (litIds.value.includes(node.id)) return

  const before = chainEnd.value
  litIds.value = lightUp(node.id)
  const after = chainEnd.value
  if (after > before) burnFrom(before, after)
}

function burnFrom(before, after) {
  const events = STORY_EVENTS.filter((e) => {
    const s = stationTimeOfAt(e.at)
    const s0 = stationTimeOfAt(before - 1)
    const s1 = stationTimeOfAt(after - 1)
    return s > s0 && s <= s1
  }).map((e) => ({ event: e, s: stationTimeOfAt(e.at) }))

  burning.value = true
  sfxIgnite()
  globeRef.value?.ignite(Math.max(0, before - 1), after - 1, {
    events,
    onEvent(event) {
      pausedEvent.value = event
      showingEvent.value = event
      if (!seenEvents.value.includes(event.id)) seenEvents.value.push(event.id)
      activeIndex.value = -1
    },
    onDone() {
      burning.value = false
    },
  })
}

function closeEvent() {
  if (!pausedEvent.value) return
  pausedEvent.value = null
  showingEvent.value = null
  globeRef.value?.resumeFire()
}

function skipBurn() {
  globeRef.value?.skipFire()
  burning.value = false
}

/* ---------------- 点击与键盘 ---------------- */

function handleTap() {
  // 章卡优先：点一下先收起章卡，不推进播放
  if (activeChapter.value) {
    window.clearTimeout(chapterTimer)
    activeChapter.value = null
    return
  }

  if (pausedEvent.value) {
    closeEvent()
    return
  }
  if (activeIndex.value >= 0) activeIndex.value = -1
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  if (settingsOpen.value) {
    closeSettings()
    return
  }
  if (pausedEvent.value) {
    closeEvent()
    return
  }
  if (activeIndex.value >= 0) {
    activeIndex.value = -1
    return
  }
  if (screen.value === 'overview') openSettings()
}

const activeChapter = ref(null)
let chapterTimer = null

watch(chainEnd, (k) => {
  const hit = CHAPTERS.find((c) => c.range[1] + 1 === k && k < longMarchNodes.length)
  if (!hit || screen.value !== 'overview') return
  activeChapter.value = hit
  window.clearTimeout(chapterTimer)
  chapterTimer = window.setTimeout(() => {
    activeChapter.value = null
  }, 4500)
})

watch(chainEnd, (k) => {
  if (k === longMarchNodes.length && !burning.value) {
    window.setTimeout(() => {
      if (chainEnd.value === longMarchNodes.length) screen.value = 'finale'
    }, 1400)
  }
})

const hint = computed(() => {
  if (screen.value !== 'overview' || settingsOpen.value) return ''
  if (pausedEvent.value) return '点击空白 · 继续'
  if (activeIndex.value >= 0) return '点击空白 · 关闭'
  if (chainEnd.value >= longMarchNodes.length) return '长征走完了'
  const next = longMarchNodes[chainEnd.value]
  return next ? `点击光点 · ${next.name}` : ''
})

const backdropImage = computed(() => (showingEvent.value ? showingEvent.value.image : ''))
const globeDimmed = computed(() => !!showingEvent.value)

onMounted(() => {
  litIds.value = readLitIds()
  window.addEventListener('keydown', handleKeydown)
  try {
    reduced.value = localStorage.getItem('march:reduced') === '1'
  } catch {
    reduced.value = false
  }
  if (reduced.value) document.documentElement.classList.add('reduce-motion')

  if (import.meta.env.DEV) {
    window.__march = { screen, litIds, chainEnd, burning, pausedEvent }
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
      :show-hint="screen === 'overview' && !settingsOpen && mode !== 'playing' && activeIndex < 0"
      :chrome="screen === 'overview'"
      :finale="screen === 'finale'"
      :labels-muted="!!showingEvent"
      :locked="mode === 'playing'"
      :burn="chainEnd >= 12 ? 1 : Math.min(0.92, chainEnd / 11 * 0.92)"
      @select="handleSelect"
      @tap="handleTap"
      @reset="activeIndex = -1"
    />

    <DetailPanel
      v-if="activeNode"
      :node="activeNode"
      :order="activeIndex + 1"
      :total="longMarchNodes.length"
      :lit="activeLit"
      :lit-count="litIds.length"
      @close="activeIndex = -1"
      @navigate="(step) => globeRef?.focusNode(longMarchNodes[(activeIndex + step + longMarchNodes.length) % longMarchNodes.length])"
      @light-up="(id) => (litIds = lightUp(id))"
    />

    <EventScene :event="showingEvent" />

    <EventRail
      v-if="screen === 'overview' && !settingsOpen"
      :events="STORY_EVENTS"
      :seen="seenEvents"
      :active-id="showingEvent ? showingEvent.id : ''"
      @select="openEventById"
    />

    <StartScreen
      v-if="screen === 'start'"
      :has-save="canResume"
      :resume-label="canResume ? `第 ${chainEnd} 站` : ''"
      @start="handleStart"
      @resume="handleResume"
      @settings="openSettings"
    />

    <SettingsPanel
      v-if="settingsOpen"
      :muted="isMuted()"
      :reduced="reduced"
      :can-restart="true"
      @close="closeSettings"
      @restart="restart"
      @toggle-mute="toggleMute"
      @toggle-motion="toggleMotion"
    />

    <FinaleScreen
      v-if="screen === 'finale'"
      @restart="restart"
      @browse="screen = 'overview'"
    />

    <p v-if="hint" class="story-hint" aria-hidden="true">{{ hint }}</p>

    <button
      v-if="burning && !pausedEvent && screen === 'overview'"
      class="skip-burn"
      type="button"
      @click.stop="skipBurn"
    >
      跳过
    </button>

    <AskPanel v-if="screen === 'overview' && !settingsOpen" />
  </div>
  <ChapterCard v-if="!showingEvent" :chapter="activeChapter" :progress="chainEnd" />
</template>

<style>
html,
body {
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



