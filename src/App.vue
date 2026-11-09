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
import { readLitIds, lightUp, saveLitIds, clearProgress } from './lib/api.js'
import { dbg } from './lib/debug.js'
import { isMuted, setMuted, startAudio, sfxIgnite, sfxPage, sfxTap } from './lib/audio.js'

const globeRef = ref(null)
const screen = ref('start') // start | overview | finale
const finaleReady = ref(false)

// 三幕：start（序章）/ playing（播放中）/ free（自由浏览）/ finale（终章）
const mode = computed(() => {
  if (screen.value === 'start') return 'start'
  if (screen.value === 'finale') return 'finale'
  if (burning.value || pausedEvent.value || showingEvent.value || activeChapter.value) return 'playing'
  return 'free'
})
const settingsOpen = ref(false)
const askOpen = ref(false)
const settingsFrom = ref('start')
const reduced = ref(false)

const activeIndex = ref(-1)
const activeNode = computed(() =>
  activeIndex.value >= 0 ? longMarchNodes[activeIndex.value] : null,
)

const litIds = ref(readLitIds())
const activeLit = computed(() => (activeNode.value ? litIds.value.includes(activeNode.value.id) : false))
// 「第 X 站」始终与当前节点同源，避免从事件栏进来时错位
const nodeOrder = computed(() => (activeNode.value ? indexOfId(activeNode.value.id) + 1 : 0))

const indexOfId = (id) => longMarchNodes.findIndex((n) => n.id === id)
const litSet = computed(() => new Set(litIds.value.map(indexOfId)))

/** 连续前缀：从瑞金开始，连续点亮的站的个数。 */
const chainEnd = computed(() => {
  let k = 0
  while (k < longMarchNodes.length && litSet.value.has(k)) k += 1
  return k
})

// 路书/事件标用"点亮到的最远一站"，不是连续前缀（允许跳站）
const railProgress = computed(() =>
  litIds.value.reduce((m, id) => Math.max(m, indexOfId(id) + 1), 0),
)

const burning = ref(false)
const pausedEvent = ref(null)
const showingEvent = ref(null)
if (import.meta.env.DEV) window.__ev = (i) => { showingEvent.value = STORY_EVENTS[i || 0] }

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
const nextNodeId = computed(() =>
  chainEnd.value >= longMarchNodes.length ? '' : longMarchNodes[chainEnd.value].id,
)

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

const stationS = computed(() => globeRef.value?.stationS || [])

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
}

/** 面板上的按钮：点亮 / 取消点亮（取消会连同其后所有站一起熄灭）。 */
function toggleLit(payload) {
  const id = typeof payload === 'string' ? payload : payload?.id
  const index = indexOfId(id)
  if (index < 0) return

  if (!litIds.value.includes(id)) {
    const before = chainEnd.value
    litIds.value = lightUp(id)
    const after = chainEnd.value
    if (after > before) burnFrom(before, after)
    return
  }

  // 取消：只保留该站之前的连续前缀
  const keep = longMarchNodes.slice(0, index).map((n) => n.id)
  litIds.value = saveLitIds(keep)
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

function finishJourney() {
  if (screen.value === 'finale') return
  showingEvent.value = null
  pausedEvent.value = false
  activeNode.value = null
  activeChapter.value = null
  window.clearTimeout(chapterTimer)
  askOpen.value = false
  document.body.style.overflow = ''
  screen.value = 'finale'
  finaleReady.value = false
  globeRef.value?.pullBack?.()
  window.setTimeout(() => {
    finaleReady.value = true
  }, 1600)
}

watch([chainEnd, burning], ([k, b]) => {
  if (k === longMarchNodes.length && !b) finishJourney()
})
// 调试入口：便于用脚本强制推进到终章
if (typeof window !== 'undefined') {
  dbg('__march', { screen, litIds, chainEnd, finishJourney })
}

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
    dbg('__march', { screen, litIds, chainEnd, burning, pausedEvent })
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    class="main-container"
    :class="{ 'is-ask-open': askOpen, 'is-scene': !!showingEvent, 'is-finale': screen === 'finale' }"
  >
    <EarthGlobe
      ref="globeRef"
      :lit-ids="litIds"
      :backdrop="backdropImage"
      :dim="globeDimmed"
      :show-hint="screen === 'overview' && !settingsOpen && mode !== 'playing' && activeIndex < 0"
      :chrome="screen === 'overview'"
      :finale="screen === 'finale'"
      :labels-muted="!!showingEvent"
      :next-id="nextNodeId"
      :locked="mode === 'playing'"
      :burn="Math.min(1, chainEnd / longMarchNodes.length)"
      :show-events="screen === 'overview' && !showingEvent && !settingsOpen"
      :labels-on="screen === 'overview'"
      :border-on="screen === 'finale'"
      @select="handleSelect"
      @select-event="openEventById"
      @tap="handleTap"
      @reset="activeIndex = -1"
    />

    <DetailPanel
      v-if="activeNode"
      :node="activeNode"
      :order="nodeOrder"
      :total="longMarchNodes.length"
      :lit="activeLit"
      :lit-count="litIds.length"
      @close="activeIndex = -1"
      @navigate="(step) => globeRef?.focusNode(longMarchNodes[(activeIndex + step + longMarchNodes.length) % longMarchNodes.length])"
      @light-up="toggleLit"
    />

    <EventScene v-if="screen !== 'finale'" :event="showingEvent" :dimmed="askOpen" />

    <EventRail
      v-if="screen === 'overview' && !settingsOpen && !showingEvent && !activeNode"
      :events="STORY_EVENTS"
      :seen="seenEvents"
      :progress="railProgress"
      :total="longMarchNodes.length - 1"
      :station-s="stationS"
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
      v-if="screen === 'finale' && finaleReady"
      @restart="restart"
      @browse="screen = 'overview'"
    />

    <p v-if="hint && !activeNode && !askOpen" class="story-hint" aria-hidden="true">
      <span>{{ hint }}</span>
      <i v-if="screen === 'overview' && !settingsOpen && mode !== 'playing'">·</i>
      <em v-if="screen === 'overview' && !settingsOpen && mode !== 'playing'">双击复位</em>
    </p>

    <button
      v-if="burning && !pausedEvent && screen === 'overview'"
      class="skip-burn"
      type="button"
      @click.stop="skipBurn"
    >
      跳过
    </button>

    <AskPanel v-if="screen === 'overview' && !settingsOpen" @update:open="askOpen = $event" />
  </div>
  <ChapterCard v-if="!showingEvent && screen !== 'finale'" :chapter="activeChapter" :progress="railProgress" />
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
  bottom: 72px;
  z-index: 8;
  margin: 0;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 11px;
  letter-spacing: 0.26em;
  color: rgba(243, 241, 230, 0.46);
  pointer-events: none;
  white-space: nowrap;
  animation: story-hint-breathe 2.8s ease-in-out infinite;
}

.story-hint i {
  font-style: normal;
  color: rgba(212, 175, 55, 0.38);
  letter-spacing: 0;
}

.story-hint em {
  font-style: normal;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: rgba(163, 168, 180, 0.5);
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

/* ---- 移动端：顶部只留一行信息，底部提示避让安全区 ---- */
@media (max-width: 768px) {
  .main-container.is-finale .route-strip,
  .main-container.is-finale .ask,
  .main-container.is-finale .story-hint {
    display: none !important;
  }

  .main-container.is-scene .masthead-sub,
  .main-container.is-ask-open .masthead-sub {
    opacity: 0;
  }

  .story-hint {
    bottom: calc(14px + env(safe-area-inset-bottom));
  }
}

/* 窄屏：路书已提示操作，底部两行提示会让画面变挤 */
@media (max-width: 480px) {
  .story-hint {
    display: none;
  }
}
</style>



