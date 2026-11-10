<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import StartScreen from './components/StartScreen.vue'
import EventScene from './components/EventScene.vue'
import DetailPanel from './components/DetailPanel.vue'
import EventRail from './components/EventRail.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import FinaleScreen from './components/FinaleScreen.vue'
import AskPanel from './components/AskPanel.vue'
import nodes from './data.js'
import { STORY_EVENTS } from './lib/story.js'
import { readLitIds, saveLitIds, clearProgress } from './lib/api.js'
import { isMuted, setMuted, isBgmOn, setBgmOn, startAudio, startBgm, sfxPage, duckBgm } from './lib/audio.js'

const EarthGlobe = defineAsyncComponent({
  loader: () => import('./components/EarthGlobe.vue'),
  onError(error, retry, fail) { mapFailed.value = true; fail() },
})
const screen = ref('start')
const globeRef = ref(null)
const mapRequested = ref(false)
const mapReady = ref(false)
const mapFailed = ref(false)
const mapEnabled = ref(true)
const stationListOpen = ref(false)
const settingsOpen = ref(false)
const askOpen = ref(false)
const reduced = ref(false)
const mutedOn = ref(isMuted())
const bgmOn = ref(isBgmOn())
const litIds = ref(readLitIds().filter(id => nodes.some(node => node.id === id)))
const activeIndex = ref(-1)
const activeNode = computed(() => nodes[activeIndex.value] || null)
const showingEvent = ref(null)
const eventIndex = computed(() => STORY_EVENTS.findIndex(event => event.id === showingEvent.value?.id))
const seenEvents = ref([])
const burning = ref(false)
const pausedEvent = ref(false)
const hasFinished = ref(false)
const chainEnd = computed(() => {
  let end = 0
  while (end < nodes.length && litIds.value.includes(nodes[end].id)) end++
  return end
})
const nextNode = computed(() => nodes[chainEnd.value])
const stationS = computed(() => mapReady.value ? globeRef.value?.stationS || [] : [])
const mapVisible = computed(() => screen.value === 'overview' && mapEnabled.value && !mapFailed.value && !showingEvent.value && !settingsOpen.value)
const blocking = computed(() => Boolean(showingEvent.value || activeNode.value || settingsOpen.value || askOpen.value))
let mapTimer
let lastFocus

function rememberFocus() { lastFocus = document.activeElement }
function restoreFocus() { nextTick(() => { if (lastFocus?.isConnected) lastFocus.focus() }) }
function scrollTop() { window.scrollTo({ top: 0, behavior: 'instant' }) }
function stopJourneyAnimation() {
  // Leave the saved route intact; finish visual progression before changing rooms.
  globeRef.value?.skipFire()
  pausedEvent.value = false
  burning.value = false
}
function clearPanels() {
  stopJourneyAnimation()
  showingEvent.value = null
  activeIndex.value = -1
  stationListOpen.value = false
}
function goTo(destination) {
  clearPanels()
  screen.value = destination
  if (destination === 'overview') {
    if (mapEnabled.value) requestMap()
    if (mapReady.value) nextTick(() => globeRef.value?.enterOverview())
  }
  scrollTop()
}
function requestMap() {
  if (mapFailed.value) return
  mapRequested.value = true
  if (!mapReady.value && !mapTimer) mapTimer = window.setTimeout(() => { mapTimer = null; if (!mapReady.value) mapFailed.value = true }, 20000)
}
watch(mapEnabled, enabled => { if (enabled && screen.value === 'overview') requestMap() })
function onMapReady() {
  mapReady.value = true
  window.clearTimeout(mapTimer)
  mapTimer = null
  if (screen.value === 'overview') nextTick(() => globeRef.value?.enterOverview())
}
function onMapError() { burning.value = false; pausedEvent.value = false; mapFailed.value = true; mapReady.value = false; window.clearTimeout(mapTimer); mapTimer = null }
function handleStart() {
  startAudio()
  startBgm()
  goTo('overview')
  sfxPage()
}
function restart() {
  clearPanels()
  clearProgress()
  litIds.value = []
  hasFinished.value = false
  seenEvents.value = []
  settingsOpen.value = false
  globeRef.value?.clearFire()
  screen.value = 'start'
  scrollTop()
}
function openSettings() { rememberFocus(); settingsOpen.value = true }
function closeSettings() { settingsOpen.value = false; restoreFocus() }
function toggleMute() { mutedOn.value = !mutedOn.value; setMuted(mutedOn.value) }
function toggleBgm() { bgmOn.value = !bgmOn.value; setBgmOn(bgmOn.value) }
function toggleMotion() {
  reduced.value = !reduced.value
  try { localStorage.setItem('march:reduced', reduced.value ? '1' : '0') } catch { /* Private mode. */ }
}
function openEventById(id) {
  const event = STORY_EVENTS.find(item => item.id === id)
  if (!event) return
  if (!showingEvent.value && !activeNode.value) rememberFocus()
  stopJourneyAnimation()
  activeIndex.value = -1
  showingEvent.value = event
  if (!seenEvents.value.includes(id)) seenEvents.value.push(id)
}
function closeEvent() {
  const resume = pausedEvent.value
  pausedEvent.value = false
  showingEvent.value = null
  if (resume) globeRef.value?.resumeFire()
  restoreFocus()
  maybeFinish()
}
function navigateEvent(step) {
  const index = eventIndex.value + step
  if (index >= 0 && index < STORY_EVENTS.length) openEventById(STORY_EVENTS[index].id)
}
function selectNode(node) {
  if (!activeNode.value && !showingEvent.value) rememberFocus()
  showingEvent.value = null
  activeIndex.value = nodes.findIndex(item => item.id === node.id)
  stationListOpen.value = false
  if (mapReady.value && mapVisible.value) globeRef.value?.focusNode(node, { silent: true })
}
function closeNode() { activeIndex.value = -1; restoreFocus(); maybeFinish() }
function navigateNode(step) { selectNode(nodes[(activeIndex.value + step + nodes.length) % nodes.length]) }
function stationAt(at) {
  const s = stationS.value
  const floor = Math.max(0, Math.floor(at))
  return (s[floor] || 0) + ((s[Math.min(floor + 1, s.length - 1)] || 0) - (s[floor] || 0)) * (at - floor)
}
function toggleLit(payload) {
  const id = typeof payload === 'string' ? payload : payload?.id
  const index = nodes.findIndex(node => node.id === id)
  if (index < 0 || burning.value) return
  if (litIds.value.includes(id)) {
    litIds.value = saveLitIds(litIds.value.filter(value => nodes.findIndex(node => node.id === value) < index))
    hasFinished.value = false
    return
  }
  const before = chainEnd.value
  litIds.value = saveLitIds([...litIds.value, id])
  const after = chainEnd.value
  // No animation exists for a single point; keep its reading panel usable.
  if (after <= Math.max(1, before) || !mapReady.value || !mapVisible.value || reduced.value) return
  burning.value = true
  globeRef.value?.ignite(Math.max(0, before - 1), after - 1, {
    events: STORY_EVENTS.filter(event => event.at > Math.max(0, before - 1) && event.at <= after - 1).map(event => ({ event, s: stationAt(event.at) })),
    onEvent(event) {
      pausedEvent.value = true
      showingEvent.value = event
      activeIndex.value = -1
      if (!seenEvents.value.includes(event.id)) seenEvents.value.push(event.id)
    },
    onDone() { burning.value = false; maybeFinish() },
  })
}
function skipBurn() { globeRef.value?.skipFire(); burning.value = false; maybeFinish() }
function maybeFinish() {
  if (chainEnd.value !== nodes.length || burning.value || showingEvent.value || activeNode.value || hasFinished.value) return
  hasFinished.value = true
  screen.value = 'finale'
  scrollTop()
}
function keydown(event) {
  if (event.key !== 'Escape') return
  if (settingsOpen.value) closeSettings()
  else if (showingEvent.value) closeEvent()
  else if (activeNode.value) closeNode()
  else stationListOpen.value = false
}
watch(showingEvent, event => {
  duckBgm(Boolean(event))
  if (!event) return
  const following = STORY_EVENTS[STORY_EVENTS.indexOf(event) + 1]
  if (following && !navigator.connection?.saveData) { const image = new Image(); image.src = following.image }
})
watch(reduced, value => document.documentElement.classList.toggle('reduce-motion', value))
watch([screen, showingEvent], () => {
  document.title = `${showingEvent.value?.title || ({ start: '长征主题数字展馆', overview: '山河路书', chapters: '章节展陈', finale: '薪火千秋' })[screen.value]} · 长征万里`
})
onMounted(() => {
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  try { const saved = localStorage.getItem('march:reduced'); reduced.value = saved === null ? systemReduced : saved === '1' } catch { reduced.value = systemReduced }
  if (navigator.connection?.saveData) mapEnabled.value = false
  window.addEventListener('keydown', keydown)
})
onBeforeUnmount(() => { window.removeEventListener('keydown', keydown); window.clearTimeout(mapTimer) })
</script>

<template>
  <div class="museum-app" :class="{ 'is-route': screen === 'overview', 'has-exhibit': showingEvent }">
    <div class="museum-base" :inert="blocking || undefined">
      <StartScreen v-if="screen === 'start'" :has-save="litIds.length > 0" :resume-label="`已点亮 ${litIds.length} / 12 站`" @start="handleStart" @resume="handleStart" @browse="goTo('chapters')" @settings="openSettings" />
      <template v-else-if="screen !== 'finale'">
        <header class="museum-header">
          <button class="museum-brand" type="button" @click="goTo('start')"><span>长征万里 · 薪火千秋</span><small>长征主题数字展馆</small></button>
          <nav aria-label="展馆导航">
            <button type="button" @click="goTo('start')">序厅</button>
            <button type="button" :aria-current="screen === 'overview' ? 'page' : undefined" @click="goTo('overview')">山河路书</button>
            <button type="button" :aria-current="screen === 'chapters' ? 'page' : undefined" @click="goTo('chapters')">章节展陈</button>
            <button type="button" @click="openSettings">设置</button>
          </nav>
        </header>
        <main v-if="screen === 'overview'" class="route-room">
          <div class="route-heading">
            <p class="eyebrow">1934 — 1936 / 山河路书</p>
            <h1>循着足迹，<br>走进历史。</h1>
            <p class="route-intro">十二处坐标，连起一段征途。<br>选择站点，阅读山河之间的故事。</p>
            <div class="route-progress"><span>行程留痕</span><strong>{{ litIds.length }} <i>/ 12</i></strong><div class="progress-track"><span :style="{ width: `${litIds.length / nodes.length * 100}%` }"></span></div></div>
            <button v-if="nextNode" type="button" class="museum-button" @click="selectNode(nextNode)">走近{{ nextNode.name }} <span aria-hidden="true">↗</span></button>
            <button v-else type="button" class="museum-button" @click="screen = 'finale'">抵达终章 <span aria-hidden="true">↗</span></button>
            <div class="route-tools">
              <button type="button" :aria-expanded="stationListOpen" @click="stationListOpen = !stationListOpen">全部站点 {{ stationListOpen ? '−' : '+' }}</button>
              <button type="button" :aria-pressed="!mapEnabled" @click="mapEnabled = !mapEnabled">{{ mapEnabled ? '静态导览' : '三维地图' }}</button>
            </div>
            <ol v-if="stationListOpen" class="station-list" aria-label="十二站导览">
              <li v-for="(node, i) in nodes" :key="node.id"><button type="button" @click="selectNode(node)"><span>{{ String(i + 1).padStart(2, '0') }}</span>{{ node.name }}<small>{{ litIds.includes(node.id) ? '已点亮' : '阅读' }}</small></button></li>
            </ol>
          </div>
          <div v-if="!mapEnabled || mapFailed" class="static-guide">
            <p class="eyebrow">{{ mapFailed ? '地图暂不可用 · 仍可继续参观' : '静态导览' }}</p><h2>山河之间，步履不停。</h2>
            <ol><li v-for="(node, i) in nodes" :key="node.id"><button type="button" @click="selectNode(node)"><span>{{ String(i + 1).padStart(2, '0') }}</span><strong>{{ node.name }}</strong><small>{{ node.date }}</small><em>{{ litIds.includes(node.id) ? '已点亮' : '走近这一站 ↗' }}</em></button></li></ol>
          </div>
          <p v-else-if="!mapReady" class="map-loading" role="status">山河正在展开… <span>可先选择站点或浏览下方章节</span></p>
          <p v-else class="map-instruction">拖动探索 · 滚轮缩放 · 双击复位</p>
          <p class="route-scope">以中央红军行程及重要会师节点为线索，路线为概括示意。</p>
          <EventRail :events="STORY_EVENTS" :seen="seenEvents" :progress="chainEnd - 1" :total="nodes.length - 1" :station-s="stationS" @select="openEventById" />
          <button v-if="burning && !pausedEvent" type="button" class="skip-animation" @click="skipBurn">跳过路线动画</button>
        </main>
        <main v-else class="chapter-index">
          <div class="index-heading"><div><p class="eyebrow">八个篇章 / 一段征途</p><h1>山河为证。</h1></div><p>从江河到雪山，从转折到会师。<br>选择一个章节，读懂一段历史。</p></div>
          <div class="chapter-grid">
            <button v-for="(event, i) in STORY_EVENTS" :key="event.id" type="button" class="chapter-entry" @click="openEventById(event.id)">
              <div class="chapter-image"><img :src="event.image" :alt="`${event.title}氛围示意图，AI生成`" loading="lazy" decoding="async" width="960" height="600"><span>{{ String(i + 1).padStart(2, '0') }}</span></div>
              <p>{{ event.date }}</p><h2>{{ event.title }}<span aria-hidden="true">↗</span></h2><small>{{ event.place }} · AI 氛围示意图</small>
            </button>
          </div>
          <footer class="index-footer"><span>图像为 AI 生成的氛围示意，不代表历史实拍。</span><button type="button" @click="goTo('overview')">回到山河路书 ↗</button></footer>
        </main>
      </template>
    </div>
    <div v-show="mapVisible" class="map-stage" :inert="blocking || undefined"><EarthGlobe v-if="mapRequested && !mapFailed" ref="globeRef" :lit-ids="litIds" :chrome="false" :labels-on="screen === 'overview'" :show-events="false" :next-id="nextNode?.id || ''" :locked="blocking || burning" :visible="mapVisible" :reduced="reduced" :border-on="chainEnd >= nodes.length" @ready="onMapReady" @error="onMapError" @select="selectNode" @select-event="openEventById" /></div>
    <DetailPanel v-if="activeNode" :node="activeNode" :busy="burning" :order="activeIndex + 1" :total="nodes.length" :lit="litIds.includes(activeNode.id)" :lit-count="litIds.length" :later-lit-count="litIds.filter(id => nodes.findIndex(node => node.id === id) > activeIndex).length" @close="closeNode" @navigate="navigateNode" @light-up="toggleLit" />
    <EventScene :event="showingEvent" :index="eventIndex" :total="STORY_EVENTS.length" :return-label="screen === 'chapters' ? '返回章节' : '返回路线'" :dimmed="askOpen" @close="closeEvent" @navigate="navigateEvent" />
    <SettingsPanel v-if="settingsOpen" :muted="mutedOn" :bgm="bgmOn" :reduced="reduced" @close="closeSettings" @restart="restart" @toggle-mute="toggleMute" @toggle-bgm="toggleBgm" @toggle-motion="toggleMotion" />
    <FinaleScreen v-if="screen === 'finale'" :lit-count="litIds.length" @restart="restart" @browse="goTo('overview')" />
    <AskPanel v-if="screen !== 'start' && screen !== 'finale' && !settingsOpen && !showingEvent && !activeNode" @update:open="askOpen = $event" />
  </div>
</template>

<style scoped>
.is-route :deep(.ask:not(.is-open)) { bottom:190px; }
@media(max-width:768px){.is-route :deep(.ask:not(.is-open)){bottom:210px}}
.map-stage { position:fixed; inset:100px 0 0 24%; z-index:1; overflow:hidden; }
.map-stage::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,#181a17,transparent 32%),linear-gradient(0deg,#181a17,transparent 28%)}
@media(min-width:1700px){.map-stage{top:112px}}
@media(max-width:768px){.map-stage{inset:330px 0 160px}.map-stage::after{background:linear-gradient(180deg,#181a17,transparent 24%,transparent 80%,#181a17)}}
@media(max-width:480px){.map-stage{top:390px;bottom:180px}}
.museum-app { min-height: 100svh; background: var(--museum-ink); }
.museum-header { position: relative; z-index: 10; height: 100px; display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 0 var(--page-gutter); background: var(--museum-ink); border-bottom: 1px solid var(--hairline-soft); }
.museum-brand { border: 0; background: none; color: var(--museum-paper); padding: 0; text-align: left; }
.museum-brand span { display:block; font: 500 23px var(--font-display); letter-spacing: .08em; }
.museum-brand small { display:block; color: var(--accent-gold); font-size: 13px; margin-top: 6px; letter-spacing: .12em; }
.museum-header nav { display: flex; gap: 30px; }
.museum-header nav button { min-height: 48px; padding: 8px 0; background:none; border:0; border-bottom:1px solid transparent; color:var(--text-muted); font-size:15px; }
.museum-header nav button[aria-current],.museum-header nav button:hover { color:var(--museum-paper); border-color:var(--accent-gold); }
.route-room { position: relative; min-height: calc(100svh - 100px); z-index: 2; pointer-events: none; }
.route-heading { position:relative; z-index:3; width: min(350px,30vw); margin-left:var(--page-gutter); padding-top: clamp(32px,5vh,64px); pointer-events:auto; }
.route-heading h1 { font:500 clamp(36px,3.3vw,60px)/1.35 var(--font-display); margin:18px 0; letter-spacing:.04em; }
.route-intro { color:var(--text-muted); font-size:16px; line-height:1.9; }
.route-progress { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:space-between; gap:12px; margin:32px 0 24px; max-width:270px; font-size:14px; color:var(--text-muted); }
.route-progress strong { font:400 28px Georgia,serif; color:var(--museum-paper); }.route-progress i{font:14px var(--font-body);color:var(--text-muted)}
.progress-track { width:100%;height:2px;background:#45483d; }.progress-track span { display:block;height:100%;background:var(--accent-gold);transition:width .4s; }
.route-tools { display:flex;gap:24px;margin-top:24px; }.route-tools button { border:0;border-bottom:1px solid var(--hairline);padding:8px 0;min-height:44px;background:none;color:var(--museum-paper);font-size:14px; }
.station-list { position:absolute; top:100%; left:0; width:310px; max-height: min(360px,45svh); overflow:auto; padding:10px 20px; margin:8px 0; background:#242820; border:1px solid var(--hairline); list-style:none; box-shadow:0 12px 40px #0005; }
.station-list button { width:100%;display:flex;gap:18px;align-items:center;min-height:44px;background:none;border:0;border-bottom:1px solid var(--hairline-soft);color:var(--museum-paper);text-align:left;font-size:16px; }.station-list span{font:13px Georgia;color:var(--accent-gold)}.station-list small{margin-left:auto;font-size:13px;color:var(--text-muted)}
.map-instruction,.route-scope,.map-loading { position:absolute;right:var(--page-gutter);font-size:13px;color:var(--text-muted);margin:0; }
.map-instruction{top:28px}.route-scope{bottom:174px;max-width:440px;text-align:right}.map-loading{top:42%;right:24%;text-align:center;color:var(--museum-paper);font-size:18px}.map-loading span{display:block;font-size:14px;color:var(--text-muted);margin-top:10px}
.static-guide{position:relative;margin:-330px var(--page-gutter) 200px max(440px,35vw);padding:20px 0;pointer-events:auto}.static-guide h2{font:500 32px var(--font-display);margin:12px 0 24px}.static-guide ol{padding:0;list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.static-guide li{min-width:0}.static-guide button{display:flex;flex-direction:column;align-items:flex-start;width:100%;min-height:150px;padding:18px;border:1px solid #55584b;background:#23271f;color:var(--museum-paper);text-align:left;gap:6px}.static-guide button>span{font:14px Georgia;color:var(--accent-gold)}.static-guide strong{font:500 23px var(--font-display)}.static-guide small,.static-guide em{font-size:13px;font-style:normal;color:var(--text-muted)}.static-guide button:hover{border-color:var(--accent-gold)}
.skip-animation{position:fixed;right:var(--page-gutter);bottom:185px;z-index:20;pointer-events:auto;min-height:44px;border:1px solid var(--hairline);background:var(--museum-ink);color:var(--museum-paper);padding:8px 18px}
.chapter-index{background:var(--museum-paper);color:var(--museum-ink);padding:64px var(--page-gutter) 120px;min-height:calc(100svh - 100px)}
.index-heading{display:flex;justify-content:space-between;align-items:end;gap:32px;max-width:1680px;margin:0 auto 54px}.index-heading .eyebrow{color:#7a4c3d}.index-heading h1{font:500 clamp(48px,4.5vw,80px)/1.2 var(--font-display);margin:16px 0 0}.index-heading>p{color:#65675f;font-size:16px;line-height:1.9}
.chapter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:40px 28px;max-width:1680px;margin:auto}.chapter-entry{min-width:0;padding:0 0 20px;background:none;border:0;border-bottom:1px solid #c9c1b1;text-align:left;color:var(--museum-ink)}.chapter-image{position:relative;overflow:hidden;background:#d5cdbf;aspect-ratio:1.32}.chapter-image img{width:100%;height:100%;object-fit:cover;filter:saturate(.55);transition:transform .5s var(--ease),filter .5s}.chapter-entry:hover img{transform:scale(1.035);filter:saturate(.85)}.chapter-image>span{position:absolute;left:14px;top:12px;font:24px Georgia;color:var(--museum-paper);background:#181a17c9;padding:4px 9px}.chapter-entry>p{font-size:13px;color:#75634b;margin-top:18px}.chapter-entry h2{display:flex;align-items:center;justify-content:space-between;font:500 29px var(--font-display);margin:12px 0}.chapter-entry h2 span{font:22px var(--font-body);color:var(--accent-red)}.chapter-entry small{font-size:13px;color:#65675f}.index-footer{display:flex;justify-content:space-between;gap:24px;margin:48px auto 0;max-width:1680px;color:#65675f;font-size:13px}.index-footer button{border:0;background:none;color:var(--accent-red);font-size:15px;min-height:44px}
@media(min-width:1700px){.route-heading{width:380px}.static-guide{margin-left:32vw}.museum-header{height:112px}.route-room{min-height:calc(100svh - 112px)}}
@media(max-width:1100px){.chapter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.museum-header nav{gap:20px}.static-guide{margin-left:380px}.static-guide ol{grid-template-columns:repeat(2,minmax(0,1fr))}.route-scope{max-width:300px}}
@media(max-width:768px){.museum-header{height:auto;min-height:114px;align-items:flex-start;flex-direction:column;gap:10px;padding:18px 24px 10px}.museum-brand span{font-size:20px}.museum-brand small{display:none}.museum-header nav{width:100%;justify-content:space-between;gap:10px}.museum-header nav button{font-size:14px;min-height:38px}.route-room{min-height:calc(100svh - 114px)}.route-heading{width:auto;margin:0 24px;padding-top:24px}.route-heading h1{font-size:36px;margin:10px 0}.route-heading h1 br{display:none}.route-intro{font-size:14px}.route-intro br{display:none}.route-progress{margin:18px 0 14px;max-width:260px}.route-heading .museum-button{min-height:44px}.route-tools{position:absolute;right:0;bottom:0;gap:14px}.station-list{top:100%;left:auto;right:0;width:min(340px,100%)}.map-instruction{top:auto;bottom:185px;font-size:13px;right:24px}.route-scope{display:none}.map-loading{top:50%;left:24px;right:24px;font-size:16px}.map-loading span{font-size:13px}.static-guide{margin:30px 24px 190px;padding:0}.static-guide h2{font-size:28px}.static-guide ol{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.static-guide button{min-height:136px;padding:14px}.chapter-index{padding:36px 24px 100px}.index-heading{display:block;margin-bottom:32px}.index-heading>p{margin-top:20px;font-size:15px}.chapter-grid{gap:28px 18px}.chapter-entry h2{font-size:24px}.index-footer{display:block}.index-footer button{margin-top:16px}}
@media(max-width:480px){.route-heading h1{font-size:30px}.route-tools{position:static;margin-top:10px}.route-progress{margin:14px 0;max-width:100%}.route-intro{max-width:32ch}.route-heading .eyebrow{font-size:12px}.chapter-grid{grid-template-columns:1fr}.index-heading h1{font-size:48px}.chapter-image{aspect-ratio:1.6}.static-guide{margin-top:26px}.static-guide button{padding:12px}.map-instruction{display:none}}
@media(prefers-reduced-motion:reduce){.chapter-image img,.progress-track span{transition:none}}
</style>
