<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  event: { type: Object, default: null },
  dimmed: { type: Boolean, default: false },
  index: { type: Number, default: 0 },
  total: { type: Number, default: 8 },
  returnLabel: { type: String, default: '返回路线' },
})
const emit = defineEmits(['close', 'navigate'])
const reader = ref(null)
const backButton = ref(null)
const imageFailed = ref(false)
const chapterNumber = computed(() => String(props.index + 1).padStart(2, '0'))
const imageCredit = computed(() => {
  const credit = props.event?.credit || ''
  return credit && !credit.includes('占位') && !credit.includes('AI')
    ? `${credit} · AI 生成示意，非历史影像`
    : 'AI 生成的历史场景示意，非历史影像'
})

function trapFocus(event) {
  if (event.key !== 'Tab' || !reader.value) return
  const targets = [...reader.value.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')]
  const first = targets[0]
  const last = targets.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}

watch(() => props.event?.id, async (id) => {
  imageFailed.value = false
  if (!id) return
  await nextTick()
  reader.value?.scrollTo({ top: 0, behavior: 'instant' })
  backButton.value?.focus({ preventScroll: true })
}, { immediate: true })
</script>

<template>
  <Transition name="exhibit">
    <section v-if="event" ref="reader" class="event-scene" :class="{ 'is-dimmed': dimmed }" role="dialog" aria-modal="true" aria-labelledby="exhibit-title" tabindex="-1" @keydown="trapFocus">
      <div class="exhibit-shell">
        <header class="exhibit-topbar">
          <button ref="backButton" class="exhibit-back" type="button" @click="emit('close')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13" /></svg>{{ returnLabel }}
          </button>
          <p class="exhibit-collection">长征万里 <span>／</span> 历史现场</p>
          <span class="exhibit-count">{{ chapterNumber }} <i>/ {{ String(total).padStart(2, '0') }}</i></span>
        </header>
        <article :key="event.id" class="exhibit-article">
          <div class="exhibit-heading">
            <div class="exhibit-kicker"><span class="exhibit-chapter">第 {{ chapterNumber }} 章</span><span>{{ event.date }}</span></div>
            <div class="exhibit-title-row"><h2 id="exhibit-title">{{ event.title }}</h2><p class="exhibit-location">{{ event.place }}</p></div>
          </div>
          <div class="exhibit-layout">
            <figure class="exhibit-visual">
              <div class="exhibit-image-frame">
                <img v-if="event.image && !imageFailed" :src="event.image" :alt="`${event.title}的 AI 场景示意`" decoding="async" @error="imageFailed = true" />
                <div v-else class="exhibit-image-fallback"><span>山河为证</span><p>{{ event.place }}</p></div>
                <span class="exhibit-image-label">历史场景 · AI 示意</span>
              </div>
              <figcaption><span>图 {{ chapterNumber }}</span>{{ imageCredit }}</figcaption>
            </figure>
            <div class="exhibit-narrative">
              <span class="exhibit-section-label">历史经过</span>
              <p class="exhibit-prose">{{ event.text }}</p>
              <section v-if="event.points?.length" class="exhibit-facts" aria-label="事件要点">
                <h3>铭记这一刻</h3>
                <ol><li v-for="(point, i) in event.points" :key="i"><span>{{ String(i + 1).padStart(2, '0') }}</span><p>{{ point }}</p></li></ol>
              </section>
              <section v-if="event.diagram" class="exhibit-crossings" aria-label="四渡赤水示意">
                <h3>四次渡河，一场战略转折</h3>
                <ol><li v-for="(place, i) in ['土城', '太平渡', '茅台', '二郎滩']" :key="place"><span>{{ String(i + 1).padStart(2, '0') }}</span>{{ place }}</li></ol>
                <p>渡口顺序示意，不代表实际地理距离。</p>
              </section>
              <div class="exhibit-source"><span>资料说明</span><div><p>{{ event.source || '参考文献：《中国共产党历史》第一卷。配图用于辅助理解历史场景，不作为史实证据。' }}</p><ul v-if="event.sources?.length"><li v-for="source in event.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }} <span aria-hidden="true">↗</span></a></li></ul></div></div>
            </div>
          </div>
        </article>
        <footer class="exhibit-footer">
          <button class="chapter-nav" type="button" :disabled="index <= 0" @click="emit('navigate', -1)"><span aria-hidden="true">←</span><span>上一章</span></button>
          <p>沿着来路，读懂每一次向前。</p>
          <button v-if="index < total - 1" class="chapter-nav chapter-nav-next" type="button" @click="emit('navigate', 1)"><span>下一章</span><span aria-hidden="true">→</span></button>
          <button v-else class="chapter-nav chapter-nav-next" type="button" @click="emit('close')"><span>{{ returnLabel }}</span><span aria-hidden="true">↗</span></button>
        </footer>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.event-scene { position: fixed; inset: 0; z-index: 40; overflow: auto; overscroll-behavior: contain; background: var(--museum-paper, #f2ebdd); color: var(--museum-ink, #181a17); font-family: var(--font-body, sans-serif); scrollbar-width: thin; scrollbar-color: #a89a83 #e8dfce; pointer-events: auto; }
.event-scene::-webkit-scrollbar { display: block; width: 7px; }
.event-scene::-webkit-scrollbar-thumb { background: #a89a83; border-radius: 8px; }
.exhibit-shell { width: min(100% - 128px, 1680px); margin: 0 auto; padding-bottom: max(28px, env(safe-area-inset-bottom)); }
.exhibit-topbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 106px; border-bottom: 1px solid #cfc5b5; }
.exhibit-back, .chapter-nav { display: inline-flex; align-items: center; justify-content: center; gap: 16px; min-height: 48px; padding: 8px 0; border: 0; background: transparent; color: inherit; font-size: 15px; cursor: pointer; }
.exhibit-back svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.3; }
.exhibit-back:hover, .chapter-nav:hover:not(:disabled) { color: var(--accent-red, #a6362b); }
.exhibit-collection { font-family: var(--font-display, serif); font-size: 17px; letter-spacing: .12em; }
.exhibit-collection span { margin: 0 12px; color: #867c6c; }
.exhibit-count { font-size: 16px; font-variant-numeric: tabular-nums; letter-spacing: .08em; }
.exhibit-count i { font-style: normal; color: #736a5d; }
.exhibit-heading { padding: clamp(40px, 5.5vw, 90px) 0 42px; }
.exhibit-kicker { display: flex; flex-wrap: wrap; align-items: center; gap: 22px; margin-bottom: 24px; font-size: 13px; color: #665e51; letter-spacing: .06em; }
.exhibit-chapter { color: var(--accent-red, #a6362b); font-weight: 600; }
.exhibit-chapter::after { content: ''; display: inline-block; width: 34px; height: 1px; margin: 0 0 4px 22px; background: #b7a58b; }
.exhibit-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
.exhibit-title-row h2 { margin: 0; font-family: var(--font-display, serif); font-weight: 500; font-size: clamp(40px, 4.4vw, 64px); line-height: 1.25; letter-spacing: .05em; }
.exhibit-location { font-size: 14px; color: #665e51; white-space: nowrap; }
.exhibit-layout { display: grid; grid-template-columns: minmax(0, 55fr) minmax(0, 45fr); align-items: start; gap: clamp(36px, 5vw, 88px); }
.exhibit-visual { min-width: 0; margin: 0; }
.exhibit-image-frame { position: relative; aspect-ratio: 4 / 5; overflow: hidden; background: #d6cebd; }
.exhibit-image-frame img { display: block; width: 100%; height: 100%; object-fit: cover; filter: saturate(.7); }
.exhibit-image-label { position: absolute; bottom: 20px; left: 20px; padding: 7px 10px; color: #f9f4ea; background: #232722; font-size: 13px; letter-spacing: .04em; }
.exhibit-image-fallback { display: grid; align-content: center; justify-items: center; height: 100%; padding: 24px; background: linear-gradient(145deg, #adaf9e, #3c4b40); color: #f2ebdd; }
.exhibit-image-fallback span { font-family: var(--font-display, serif); font-size: 38px; letter-spacing: .2em; }
.exhibit-image-fallback p { margin-top: 20px; font-size: 14px; }
.exhibit-visual figcaption { display: flex; gap: 20px; padding-top: 15px; font-size: 13px; line-height: 1.8; color: #706758; }
.exhibit-visual figcaption span { flex: none; color: #373c33; }
.exhibit-narrative { min-width: 0; padding-top: 4px; }
.exhibit-section-label { display: block; margin-bottom: 21px; font-size: 13px; letter-spacing: .12em; color: var(--accent-red, #a6362b); }
.exhibit-prose { margin: 0; font-size: clamp(17px, 1.25vw, 19px); line-height: 2.05; letter-spacing: .025em; color: #32382e; }
.exhibit-facts { margin-top: 38px; padding-top: 28px; border-top: 1px solid #cfc5b5; }
.exhibit-facts h3, .exhibit-crossings h3 { margin: 0 0 22px; font-family: var(--font-display, serif); font-size: 22px; font-weight: 500; letter-spacing: .04em; }
.exhibit-facts ol { display: grid; gap: 22px; margin: 0; padding: 0; list-style: none; }
.exhibit-facts li { display: grid; grid-template-columns: 27px 1fr; align-items: baseline; gap: 18px; }
.exhibit-facts li > span { color: var(--accent-red, #a6362b); font-size: 13px; font-variant-numeric: tabular-nums; }
.exhibit-facts li p { font-size: 16px; line-height: 1.85; color: #454a3e; }
.exhibit-crossings { margin-top: 34px; padding: 25px 0; border-top: 1px solid #cfc5b5; border-bottom: 1px solid #cfc5b5; }
.exhibit-crossings ol { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 0; list-style: none; }
.exhibit-crossings li { display: flex; flex-direction: column; gap: 9px; padding: 12px 6px 0 0; border-top: 1px solid #a6362b; font-size: 14px; }
.exhibit-crossings li span { color: #a6362b; font-size: 13px; }
.exhibit-crossings > p { margin-top: 20px; color: #706758; font-size: 13px; }
.exhibit-source { display: grid; grid-template-columns: 64px 1fr; gap: 18px; margin-top: 38px; font-size: 13px; line-height: 1.85; color: #706758; }
.exhibit-source > span { color: #454a3e; }
.exhibit-source ul { margin: 12px 0 0; padding: 0; list-style: none; }
.exhibit-source li + li { margin-top: 6px; }
.exhibit-source a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; color: #8d3027; text-decoration: underline; text-underline-offset: 4px; }
.exhibit-source a:focus-visible { outline: 2px solid #a6362b; outline-offset: 3px; }
.exhibit-footer { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; margin-top: 70px; padding-top: 22px; border-top: 1px solid #cfc5b5; }
.exhibit-footer > p { font-family: var(--font-display, serif); font-size: 15px; color: #706758; letter-spacing: .07em; }
.chapter-nav { justify-self: start; gap: 24px; min-width: 112px; }
.chapter-nav-next { justify-self: end; }
.chapter-nav:disabled { color: #9c9589; cursor: default; }
.event-scene button:focus-visible { outline: 2px solid var(--accent-red, #a6362b); outline-offset: 6px; }
.exhibit-enter-active, .exhibit-leave-active { transition: opacity 220ms ease; }
.exhibit-enter-from, .exhibit-leave-to { opacity: 0; }
@media (min-width: 1680px) { .exhibit-image-frame { aspect-ratio: 1 / 1; } }
@media (max-width: 900px) {
  .exhibit-shell { width: calc(100% - 64px); }
  .exhibit-topbar { min-height: 84px; }
  .exhibit-collection { font-size: 14px; }
  .exhibit-collection span { margin: 0 5px; }
  .exhibit-layout { grid-template-columns: 1fr; gap: 36px; }
  .exhibit-image-frame { aspect-ratio: 16 / 10; }
  .exhibit-heading { padding-top: 38px; padding-bottom: 30px; }
  .exhibit-narrative { max-width: 640px; }
  .exhibit-prose { font-size: 18px; }
  .exhibit-footer { margin-top: 48px; grid-template-columns: 1fr 1fr; }
  .exhibit-footer > p { display: none; }
}
@media (max-width: 480px) {
  .exhibit-shell { width: calc(100% - 40px); }
  .exhibit-topbar { min-height: 74px; gap: 12px; }
  .exhibit-collection { display: none; }
  .exhibit-kicker { gap: 10px; font-size: 13px; }
  .exhibit-chapter::after { width: 18px; margin-left: 10px; }
  .exhibit-title-row { align-items: flex-start; flex-direction: column; gap: 14px; }
  .exhibit-title-row h2 { font-size: 36px; }
  .exhibit-image-frame { aspect-ratio: 4 / 3; }
  .exhibit-image-label { left: 12px; bottom: 12px; }
  .exhibit-visual figcaption { gap: 12px; }
  .exhibit-prose { font-size: 17px; }
  .exhibit-facts li { gap: 10px; }
  .exhibit-source { gap: 12px; }
}
@media (prefers-reduced-motion: reduce) { .exhibit-enter-active, .exhibit-leave-active { transition: none; } }
</style>
