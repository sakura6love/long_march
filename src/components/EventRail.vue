<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  events: { type: Array, default: () => [] },
  seen: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  total: { type: Number, default: 11 },
  stationS: { type: Array, default: () => [] },
})
defineEmits(['select'])
const rail = ref(null)
const canScrollBack = ref(false)
const canScrollForward = ref(false)
let observer
const reached = (event) => props.seen.includes(event.id) || (event.at ?? 0) <= props.progress
const currentId = computed(() => {
  if (props.activeId) return props.activeId
  return [...props.events].reverse().find(reached)?.id || props.events[0]?.id
})
const dateLabel = (date = '') => {
  const match = date.match(/(\d{4})\s*·\s*(\d{2})/)
  return match ? `${match[1]}.${match[2]}` : date
}
function updateScroll() {
  if (!rail.value) return
  canScrollBack.value = rail.value.scrollLeft > 2
  canScrollForward.value = rail.value.scrollLeft + rail.value.clientWidth < rail.value.scrollWidth - 2
}
function moveRail(direction) {
  const el = rail.value
  if (!el) return
  el.scrollBy({ left: direction * Math.max(160, el.clientWidth * .72), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}
async function revealCurrent() {
  await nextTick()
  const el = rail.value
  if (!el) return
  const button = [...el.querySelectorAll('button')].find((item) => item.dataset.event === currentId.value)
  if (button) {
    const left = button.offsetLeft
    if (left < el.scrollLeft) el.scrollLeft = left
    else if (left + button.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = left + button.offsetWidth - el.clientWidth
  }
  updateScroll()
}
watch(currentId, revealCurrent)
onMounted(() => {
  observer = new ResizeObserver(updateScroll)
  if (rail.value) observer.observe(rail.value)
  revealCurrent()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <nav class="route-strip" aria-label="历史事件目录">
    <div class="rail-heading"><span>历史现场</span><p>八个时刻，万里征程</p></div>
    <div ref="rail" class="rail-list" @scroll.passive="updateScroll">
      <button
        v-for="(event, i) in events" :key="event.id" :data-event="event.id" class="rail-event"
        :class="{ 'is-current': currentId === event.id, 'is-seen': reached(event) }"
        :aria-current="currentId === event.id ? 'step' : undefined" type="button" @click.stop="$emit('select', event.id)"
      ><span class="rail-number">{{ String(i + 1).padStart(2, '0') }}<i v-if="reached(event)" aria-label="已到访">·</i></span><strong>{{ event.title }}</strong><span class="rail-date">{{ dateLabel(event.date) }}</span></button>
    </div>
    <div class="rail-controls"><button type="button" :disabled="!canScrollBack" aria-label="向前浏览事件目录" @click="moveRail(-1)">←</button><button type="button" :disabled="!canScrollForward" aria-label="向后浏览事件目录" @click="moveRail(1)">→</button></div>
  </nav>
</template>

<style scoped>
.route-strip { position: fixed; z-index: 26; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: flex; align-items: center; gap: 24px; width: min(calc(100% - 96px), 1760px); padding: 20px 24px; color: var(--museum-paper, #f2ebdd); background: #20271f; border: 1px solid #4d5345; box-shadow: 0 12px 42px #10150f26; pointer-events: auto; }
.rail-heading { flex: 0 0 136px; padding: 0 4px; }
.rail-heading > span { font-family: var(--font-display, serif); font-size: 21px; letter-spacing: .12em; }
.rail-heading p { margin-top: 6px; font-size: 13px; color: #c2c6b5; }
.rail-list { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(124px, 1fr); flex: 1; min-width: 0; gap: 0; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; scrollbar-width: none; }
.rail-list::-webkit-scrollbar { display: none; }
.rail-event { display: grid; justify-items: start; gap: 3px; min-width: 0; min-height: 82px; padding: 7px 16px 6px; border: 0; border-left: 1px solid #4c5345; background: transparent; color: #f0eddf; text-align: left; cursor: pointer; scroll-snap-align: start; transition: background 180ms ease; }
.rail-number { display: flex; align-items: center; gap: 9px; font-size: 11px; font-variant-numeric: tabular-nums; letter-spacing: .06em; color: #b6bea9; }
.rail-number i { color: #dd8b6a; font-size: 18px; font-style: normal; line-height: 10px; }
.rail-event strong { font-family: var(--font-display, serif); font-size: 16px; font-weight: 500; line-height: 1.6; white-space: nowrap; }
.rail-date { font-size: 11px; color: #b6bea9; font-variant-numeric: tabular-nums; letter-spacing: .035em; }
.rail-event:hover { background: #343d2e; }
.rail-event.is-current { background: #eee6d6; color: #242b20; border-left-color: #eee6d6; }
.rail-event.is-current .rail-number { color: #9b382d; }
.rail-event.is-current .rail-date { color: #676c5b; }
.rail-event:focus-visible { position: relative; outline: 2px solid #dcb376; outline-offset: -3px; }
.rail-controls { display: flex; flex: 0 0 auto; gap: 5px; }
.rail-controls button { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid #77806b; background: transparent; color: #eee6d6; font-size: 20px; cursor: pointer; }
.rail-controls button:hover:not(:disabled) { background: #3a442f; border-color: #c1c8b4; }
.rail-controls button:disabled { border-color: #454e3e; color: #69715f; cursor: default; }
.rail-controls button:focus-visible { outline: 2px solid #dcb376; outline-offset: 3px; }
@media (min-width: 1680px) { .rail-heading { flex-basis: 156px; } .rail-event { padding-left: 22px; } }
@media (max-width: 1200px) { .route-strip { gap: 18px; padding: 16px 20px; } .rail-heading { flex-basis: 118px; } .rail-heading > span { font-size: 19px; } .rail-heading p { font-size: 11px; } }
@media (max-width: 900px) {
  .route-strip { display: grid; grid-template-columns: 1fr auto; gap: 12px 16px; width: calc(100% - 48px); padding: 16px; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); }
  .rail-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px 14px; min-width: 0; padding: 0; }
  .rail-heading > span { font-size: 19px; }
  .rail-heading p { margin: 0; font-size: 13px; }
  .rail-controls { grid-column: 2; grid-row: 1; }
  .rail-list { grid-column: 1 / -1; grid-row: 2; grid-auto-columns: 150px; }
  .rail-event { min-height: 80px; padding-left: 16px; }
  .rail-event strong { font-size: 17px; }
}
@media (max-width: 480px) {
  .route-strip { width: calc(100% - 28px); bottom: calc(14px + env(safe-area-inset-bottom, 0px)); padding: 12px; }
  .rail-heading { gap: 0; }
  .rail-heading > span { font-size: 17px; }
  .rail-heading p { display: none; }
  .rail-list { grid-auto-columns: 145px; }
}
@media (max-height: 540px) and (orientation: landscape) { .route-strip { bottom: 12px; padding: 10px 14px; } .rail-heading, .rail-date { display: none; } .rail-event { min-height: 54px; } }
@media (prefers-reduced-motion: reduce) { .rail-event { transition: none; } }
</style>
