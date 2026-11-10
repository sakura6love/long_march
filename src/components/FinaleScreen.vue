<script setup>
defineProps({
  litCount: { type: Number, default: 12 },
})
const emit = defineEmits(['restart', 'browse'])
</script>

<template>
  <section class="finale" aria-labelledby="finale-title">
    <div class="finale-veil" aria-hidden="true"></div>
    <div class="finale-body">
      <p class="era"><span>终章</span>一九三六 · 十月</p>
      <h2 id="finale-title" class="finale-title">征途有尽<span>薪火不息</span></h2>
      <div class="finale-copy">
        <p>一九三四年十月，于都河畔出发。</p>
        <p>一九三六年十月，会宁城下会师。</p>
        <p class="finale-note">十二个坐标，重访一段不朽的征程。</p>
      </div>
      <div class="colophon">
        <div class="seal" aria-hidden="true"></div>
        <p>山河为证，初心不改。<span>纪念红军长征胜利九十周年</span></p>
      </div>
      <div class="actions">
        <button class="act act-main" type="button" @click="emit('restart')">重走长征路</button>
        <button class="act" type="button" @click="emit('browse')">留在俯瞰<span aria-hidden="true">→</span></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.finale { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; overflow-y: auto; padding: 40px 24px calc(40px + env(safe-area-inset-bottom, 0px)); }
.finale-veil { position: fixed; inset: 0; background: radial-gradient(ellipse at 50% 44%, rgba(20, 23, 20, .81), rgba(20, 23, 20, .94) 78%); pointer-events: none; animation: veil-in .8s ease both; }
.finale-body { position: relative; width: min(760px, 100%); text-align: center; }
.era { display: flex; align-items: center; justify-content: center; gap: 17px; margin: 0; color: var(--text-muted); font: 400 13px/1.6 var(--font-body); letter-spacing: .16em; }
.era > span { padding-right: 17px; border-right: 1px solid rgba(234, 226, 209, .28); color: var(--accent-gold); }
.finale-title { margin: 27px 0 0; color: var(--text-main); font: 600 52px/1.4 var(--font-display); letter-spacing: .08em; animation: rise .8s ease .1s both; }
.finale-title span { display: inline-block; margin-left: .7em; }
.finale-copy { margin-top: 28px; color: var(--text-muted); font: 400 16px/2 var(--font-body); letter-spacing: .025em; animation: rise .8s ease .25s both; }
.finale-copy p { margin: 0; }
.finale-copy .finale-note { margin-top: 13px; color: var(--text-main); }
.colophon { display: flex; justify-content: center; align-items: center; gap: 18px; margin-top: 36px; animation: rise .8s ease .4s both; }
.seal { width: 64px; height: 64px; flex: none; background: url('/seals/changzheng.webp') center / contain no-repeat; opacity: .88; }
.colophon p { margin: 0; color: var(--text-main); font: 500 15px/1.9 var(--font-display); letter-spacing: .06em; text-align: left; }
.colophon p span { display: block; margin-top: 3px; color: var(--text-muted); font: 400 12px/1.7 var(--font-body); letter-spacing: .04em; }
.actions { display: flex; justify-content: center; align-items: center; gap: 24px; margin-top: 42px; }
.act { display: inline-flex; min-height: 48px; align-items: center; justify-content: center; gap: 15px; padding: 0 18px; border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--text-muted); font: 400 14px/1.5 var(--font-body); letter-spacing: .06em; cursor: pointer; transition: color .2s ease, border-color .2s ease, background-color .2s ease; }
.act:hover { color: var(--text-main); }
.act:focus-visible { outline: 2px solid var(--paper); outline-offset: 5px; }
.act-main { border-color: rgba(234, 226, 209, .34); color: var(--text-main); padding-inline: 23px; }
.act-main:hover { border-color: var(--paper); background: rgba(234, 226, 209, .07); }
@keyframes veil-in { from { opacity: 0; } }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
@media (max-width: 1600px) { .finale-title { font-size: 46px; } }
@media (max-width: 768px) {
  .finale { padding: 32px 24px calc(32px + env(safe-area-inset-bottom, 0px)); }
  .era { font-size: 12px; }
  .finale-title { margin-top: 23px; font-size: 38px; }
  .finale-title span { display: block; margin-left: 0; }
  .finale-copy { margin-top: 22px; font-size: 14px; line-height: 1.95; letter-spacing: 0; }
  .finale-copy .finale-note { margin-top: 14px; }
  .colophon { gap: 14px; margin-top: 27px; }
  .seal { width: 54px; height: 54px; }
  .colophon p { font-size: 14px; }
  .colophon p span { font-size: 11px; }
  .actions { margin-top: 29px; gap: 12px; }
  .act { font-size: 13px; padding-inline: 15px; }
}
@media (max-height: 650px) and (min-width: 769px) {
  .finale { padding-block: 28px; }
  .finale-title { font-size: 40px; margin-top: 18px; }
  .finale-copy { margin-top: 18px; font-size: 14px; }
  .colophon { margin-top: 22px; }
  .actions { margin-top: 24px; }
}
@media (max-height: 480px) and (orientation: landscape) {
  .finale { padding: 18px 24px; }
  .era { font-size: 11px; }
  .finale-title { margin-top: 12px; font-size: 30px; line-height: 1.3; }
  .finale-title span { display: inline-block; margin-left: .6em; }
  .finale-copy { margin-top: 12px; font-size: 12px; line-height: 1.7; }
  .finale-copy .finale-note { margin-top: 6px; }
  .colophon { margin-top: 14px; gap: 12px; }
  .seal { width: 40px; height: 40px; }
  .colophon p { font-size: 12px; }
  .colophon p span { font-size: 10px; margin-top: 0; }
  .actions { margin-top: 15px; }
  .act { min-height: 44px; font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .finale-veil, .finale-title, .finale-copy, .colophon { animation: none; }
  .act { transition: none; }
}
html.reduce-motion .finale-veil,
html.reduce-motion .finale-title,
html.reduce-motion .finale-copy,
html.reduce-motion .colophon { animation: none; }
html.reduce-motion .act { transition: none; }
</style>
