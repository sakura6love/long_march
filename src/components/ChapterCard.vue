<script setup>
defineProps({
  chapter: { type: Object, default: null },
  progress: { type: Number, default: 0 },
})
const CN = ['零', '一', '二', '三', '四']
function cn(n) {
  return CN[n] || String(n)
}
</script>

<template>
  <div class="chapter-layer" aria-live="polite" aria-atomic="true">
    <Transition name="card">
      <section v-if="chapter" :key="chapter.id" class="chapter-card" aria-label="章节回顾">
        <div class="chapter-meta">
          <p class="chapter-no">第 {{ cn(chapter.index) }} 章</p>
          <p class="chapter-date">{{ chapter.date }}</p>
        </div>
        <h2 class="chapter-name">{{ chapter.name }}</h2>
        <p class="chapter-line">{{ chapter.line }}</p>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.chapter-layer { position: fixed; inset: 0; z-index: 9000; pointer-events: none; }
.chapter-card { position: absolute; top: 13vh; left: 50%; width: min(480px, 78vw); transform: translateX(-50%); padding: 22px 28px 25px; border: 1px solid rgba(234, 226, 209, .3); border-top: 3px solid var(--accent-red); border-radius: 2px; background: var(--paper); box-shadow: 0 10px 36px rgba(0, 0, 0, .2); color: var(--ink); }
.chapter-meta { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
.chapter-no { margin: 0; color: var(--accent-red); font: 500 12px/1.6 var(--font-body); letter-spacing: .14em; }
.chapter-date { margin: 0; color: var(--paper-muted); font: 400 12px/1.6 var(--font-body); letter-spacing: .04em; }
.chapter-name { margin: 13px 0 0; font: 600 34px/1.35 var(--font-display); letter-spacing: .06em; }
.chapter-line { margin: 11px 0 0; color: #575448; font: 400 14px/1.85 var(--font-body); letter-spacing: .01em; }
.card-enter-active, .card-leave-active { transition: opacity .45s ease, transform .45s var(--ease); }
.card-enter-from, .card-leave-to { opacity: 0; transform: translate(-50%, 8px); }
@media (max-width: 768px) {
  .chapter-card { top: 14vh; width: min(440px, 88vw); padding: 18px 21px 20px; }
  .chapter-name { margin-top: 11px; font-size: 28px; }
  .chapter-line { font-size: 13px; margin-top: 9px; }
  .chapter-no, .chapter-date { font-size: 11px; }
}
@media (max-width: 420px) {
  .chapter-meta { gap: 10px; }
  .chapter-date { letter-spacing: 0; }
  .chapter-name { font-size: 26px; }
}
@media (max-height: 480px) and (orientation: landscape) {
  .chapter-card { top: 13vh; width: min(420px, 64vw); padding: 14px 20px 16px; }
  .chapter-name { margin-top: 7px; font-size: 26px; }
  .chapter-line { margin-top: 7px; font-size: 12px; line-height: 1.7; }
}
@media (prefers-reduced-motion: reduce) { .card-enter-active, .card-leave-active { transition: none; } }
html.reduce-motion .card-enter-active,
html.reduce-motion .card-leave-active { transition: none; }
</style>
