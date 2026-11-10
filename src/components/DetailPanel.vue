<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { STATS_URL } from '../lib/ai.js'

const props = defineProps({
  busy: { type: Boolean, default: false },
  node: { type: Object, default: null },
  order: { type: Number, default: 0 },
  total: { type: Number, default: 12 },
  lit: { type: Boolean, default: false },
  litCount: { type: Number, default: 0 },
  laterLitCount: { type: Number, default: 0 },
})
const emit = defineEmits(['close', 'navigate', 'light-up'])
const panel = ref(null)
const readingArea = ref(null)
const closeButton = ref(null)
const confirming = ref(false)
let confirmTimer = 0
const coordinate = computed(() => {
  if (!props.node) return ''
  const lat = `${Math.abs(props.node.lat).toFixed(2)}°${props.node.lat >= 0 ? 'N' : 'S'}`
  const lng = `${Math.abs(props.node.lng).toFixed(2)}°${props.node.lng >= 0 ? 'E' : 'W'}`
  return `${lat} / ${lng}`
})
const paragraphs = computed(() => {
  const text = props.node?.description || ''
  if (text.length < 90) return text ? [text] : []
  const mid = Math.floor(text.length / 2)
  let cut = -1
  for (let d = 0; d < 120; d += 1) {
    const right = text.indexOf('。', mid + d)
    if (right > -1 && right < text.length - 20) { cut = right + 1; break }
    const left = text.lastIndexOf('。', mid - d)
    if (left > 40) { cut = left + 1; break }
  }
  return cut < 0 ? [text] : [text.slice(0, cut).trim(), text.slice(cut).trim()].filter(Boolean)
})
const orderLabel = computed(() => `${String(props.order).padStart(2, '0')} / ${String(props.total).padStart(2, '0')}`)
const laterLit = computed(() => Math.max(0, props.laterLitCount))
const lightLabel = computed(() => {
  if (!props.lit) return '点亮此站 · 继续前行'
  if (confirming.value) return `确认取消 · 其后 ${laterLit.value} 站将熄灭`
  return '已点亮此站 · 取消点亮'
})
function onLight() {
  if (props.busy) return
  if (props.lit && laterLit.value > 0 && !confirming.value) {
    confirming.value = true
    window.clearTimeout(confirmTimer)
    confirmTimer = window.setTimeout(() => { confirming.value = false }, 4000)
    return
  }
  confirming.value = false
  window.clearTimeout(confirmTimer)
  const turningOn = !props.lit
  emit('light-up', props.node.id)
  if (turningOn) {
    fetch(STATS_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lights: Math.max(0, Math.min(props.total, props.litCount + 1)) }), keepalive: true,
    }).catch(() => {})
  }
}
function trapFocus(event) {
  if (event.key !== 'Tab' || !panel.value) return
  const targets = [...panel.value.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')]
  const first = targets[0]
  const last = targets.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
watch(() => props.node?.id, async (id) => {
  confirming.value = false
  window.clearTimeout(confirmTimer)
  if (!id) return
  await nextTick()
  readingArea.value?.scrollTo({ top: 0, behavior: 'instant' })
  closeButton.value?.focus({ preventScroll: true })
}, { immediate: true })
onBeforeUnmount(() => window.clearTimeout(confirmTimer))
</script>

<template>
  <Transition name="detail">
    <div v-if="node" class="detail-overlay" @click.self="emit('close')">
      <aside ref="panel" class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="station-title" @keydown="trapFocus">
        <div class="detail-topbar"><span>长征地理志 <i>／</i> {{ orderLabel }}</span><button ref="closeButton" class="detail-close" type="button" aria-label="关闭站点详情，返回路线" @click="emit('close')"><span>关闭</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div>
        <div ref="readingArea" class="detail-reading" tabindex="0" aria-label="站点历史资料，可上下滚动">
          <header class="detail-head">
            <p class="detail-date">{{ node.date }}</p>
            <h2 id="station-title">{{ node.name }}</h2>
            <p class="detail-coordinate">{{ coordinate }}</p>
            <blockquote v-if="node.quote" class="detail-quote">{{ node.quote }}</blockquote>
          </header>
          <div class="detail-body">
            <template v-if="node.lead">
              <p class="detail-lead">{{ node.lead }}</p>
              <section v-for="(section, i) in node.sections" :key="i" class="detail-section"><h3><span>{{ String(i + 1).padStart(2, '0') }}</span>{{ section.h }}</h3><p>{{ section.p }}</p></section>
            </template>
            <template v-else><p v-for="(paragraph, i) in paragraphs" :key="i" class="detail-text" :class="{ 'is-lead': i === 0 }">{{ paragraph }}</p></template>
          </div>
          <dl v-if="node.facts?.length" class="detail-facts"><div v-for="(fact, i) in node.facts" :key="i"><dt>{{ fact.k }}</dt><dd>{{ fact.v }}</dd></div></dl>
          <div class="detail-reference"><span>资料说明</span><p>{{ node.source || '参考《中国共产党历史》第一卷及本站长征资料整理。地图坐标为事件代表位置，行军路线为展示示意。' }}</p></div>
        </div>
        <footer class="detail-foot">
          <button class="detail-light" :disabled="busy" :class="{ 'is-lit': lit, 'is-confirming': confirming }" type="button" @click="onLight"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 4-4 6-4 10a4 4 0 0 0 8 0c0-2-1-3-2-4 0 3-3 3-2 6-4-3 3-6 0-12Z" /></svg><span aria-live="polite">{{ lightLabel }}</span></button>
          <div class="detail-steps"><button type="button" :disabled="order <= 1" @click="emit('navigate', -1)"><span aria-hidden="true">←</span> 上一站</button><span>{{ orderLabel }}</span><button type="button" :disabled="order >= total" @click="emit('navigate', 1)">下一站 <span aria-hidden="true">→</span></button></div>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.detail-overlay { position: fixed; inset: 0; z-index: 34; background: #15201866; }
.detail-panel { display: flex; flex-direction: column; width: min(600px, 100%); height: 100%; height: 100dvh; margin-left: auto; color: var(--museum-ink, #181a17); background: var(--museum-paper, #f2ebdd); box-shadow: -12px 0 64px #0a140c26; font-family: var(--font-body, sans-serif); }
.detail-topbar { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 18px; min-height: 84px; padding: 14px 42px; border-bottom: 1px solid #d0c6b6; }
.detail-topbar > span { font-size: 13px; letter-spacing: .04em; color: #655e50; font-variant-numeric: tabular-nums; }
.detail-topbar i { margin: 0 10px; color: #9b8b73; font-style: normal; }
.detail-close { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-width: 70px; min-height: 44px; padding: 0; border: 0; background: transparent; color: #3a4033; font-size: 13px; cursor: pointer; }
.detail-close svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.3; }
.detail-close:hover { color: var(--accent-red, #a6362b); }
.detail-reading { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 40px 42px; scrollbar-width: thin; scrollbar-color: #9e927d transparent; }
.detail-reading::-webkit-scrollbar { display: block; width: 6px; }
.detail-reading::-webkit-scrollbar-thumb { background: #9e927d; border-radius: 8px; }
.detail-reading:focus-visible { outline: 2px solid #a6362b; outline-offset: -4px; }
.detail-date { font-size: 13px; letter-spacing: .05em; color: var(--accent-red, #a6362b); }
.detail-head h2 { margin: 16px 0 12px; font-family: var(--font-display, serif); font-size: clamp(40px, 3.4vw, 52px); line-height: 1.3; font-weight: 500; letter-spacing: .08em; }
.detail-coordinate { font-size: 13px; color: #79705f; letter-spacing: .07em; font-variant-numeric: tabular-nums; }
.detail-quote { margin: 30px 0; padding: 2px 0 2px 18px; border-left: 2px solid var(--accent-red, #a6362b); font-family: var(--font-display, serif); font-size: 22px; line-height: 1.8; letter-spacing: .035em; color: #4c5243; }
.detail-body { margin-top: 30px; }
.detail-lead, .detail-text { font-size: 17px; line-height: 1.95; color: #393f33; letter-spacing: .015em; }
.detail-text + .detail-text { margin-top: 24px; }
.detail-lead { padding-bottom: 28px; border-bottom: 1px solid #d2c8b7; }
.detail-section { margin-top: 28px; }
.detail-section h3 { display: flex; gap: 14px; align-items: baseline; margin: 0 0 12px; font-family: var(--font-display, serif); font-size: 23px; font-weight: 500; }
.detail-section h3 span { color: #a6362b; font-family: var(--font-body, sans-serif); font-size: 13px; }
.detail-section p { font-size: 16px; line-height: 1.95; color: #454b3d; }
.detail-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 36px 0 0; padding: 24px 0; border-top: 1px solid #d2c8b7; border-bottom: 1px solid #d2c8b7; }
.detail-facts > div { min-width: 0; }
.detail-facts dt { margin: 0 0 10px; font-size: 13px; color: #79705f; }
.detail-facts dd { margin: 0; font-family: var(--font-display, serif); font-size: 23px; line-height: 1.45; color: #a6362b; overflow-wrap: anywhere; }
.detail-reference { display: grid; grid-template-columns: 60px 1fr; gap: 16px; margin-top: 28px; font-size: 13px; line-height: 1.85; color: #79705f; }
.detail-reference > span { color: #4f5744; }
.detail-foot { flex: none; padding: 18px 42px max(16px, env(safe-area-inset-bottom)); border-top: 1px solid #cfc5b5; background: #ece3d3; }
.detail-light { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 50px; padding: 10px 14px; border: 1px solid #a6362b; background: var(--accent-red, #a6362b); color: #fff7e9; font-size: 15px; line-height: 1.5; letter-spacing: .035em; cursor: pointer; }
.detail-light svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.4; flex: none; }
.detail-light:hover { background: #8d2b23; border-color: #8d2b23; }
.detail-light.is-lit { color: #35402c; background: #dce0ce; border-color: #adb69a; }
.detail-light.is-lit:hover { background: #cdd4bc; }
.detail-light.is-confirming { color: #8d2b23; background: #f4d4c6; border-color: #a6362b; }
.detail-steps { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-top: 10px; }
.detail-steps button { display: flex; align-items: center; gap: 16px; min-height: 44px; padding: 4px 0; border: 0; background: transparent; color: #38402f; font-size: 14px; cursor: pointer; }
.detail-steps button:last-child { justify-content: flex-end; }
.detail-steps button:hover:not(:disabled) { color: #a6362b; }
.detail-steps button:disabled { color: #9c9689; cursor: default; }
.detail-steps > span { color: #79705f; font-size: 13px; font-variant-numeric: tabular-nums; letter-spacing: .06em; }
.detail-panel button:focus-visible { outline: 2px solid #a6362b; outline-offset: 4px; }
.detail-enter-active, .detail-leave-active { transition: background 240ms ease; }
.detail-enter-active .detail-panel, .detail-leave-active .detail-panel { transition: transform 280ms cubic-bezier(.25, 1, .5, 1); }
.detail-enter-from, .detail-leave-to { background: transparent; }
.detail-enter-from .detail-panel, .detail-leave-to .detail-panel { transform: translateX(100%); }
@media (max-width: 900px) { .detail-panel { width: min(620px, 100%); } }
@media (max-width: 720px) { .detail-panel { width: 100%; } .detail-topbar { padding: 12px 28px; min-height: 76px; } .detail-reading { padding: 32px 28px; } .detail-foot { padding: 16px 28px max(12px, env(safe-area-inset-bottom)); } }
@media (max-width: 420px) { .detail-topbar { padding-left: 20px; padding-right: 20px; } .detail-topbar i { margin: 0 4px; } .detail-reading { padding: 28px 22px; } .detail-foot { padding-left: 20px; padding-right: 20px; } .detail-facts { gap: 10px; } .detail-facts dd { font-size: 21px; } .detail-quote { font-size: 20px; } .detail-light { font-size: 14px; } }
@media (max-height: 540px) { .detail-topbar { min-height: 64px; padding-top: 8px; padding-bottom: 8px; } .detail-foot { padding-top: 10px; padding-bottom: 6px; } .detail-steps { margin-top: 3px; } .detail-reading { padding-top: 24px; } }
@media (prefers-reduced-motion: reduce) { .detail-enter-active, .detail-leave-active, .detail-enter-active .detail-panel, .detail-leave-active .detail-panel { transition: none; } }
</style>
