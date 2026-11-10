<script setup>
defineProps({
  hasSave: { type: Boolean, default: false },
  resumeLabel: { type: String, default: '' },
})
const emit = defineEmits(['start', 'resume', 'settings'])
</script>

<template>
  <section class="prologue" aria-labelledby="prologue-title">
    <div class="prologue-scrim" aria-hidden="true"></div>
    <div class="prologue-body">
      <p class="kicker"><span aria-hidden="true"></span>纪念红军长征胜利九十周年</p>
      <h1 id="prologue-title" class="title">
        <span>长征万里</span>
        <span>薪火千秋<span class="title-stop" aria-hidden="true">。</span></span>
      </h1>
      <p class="subtitle">十二个坐标，一条改变中国的路。<br>循着山河，重访长征记忆。</p>
      <nav class="entries" aria-label="展馆入口">
        <button class="entry entry-main" type="button" @click="emit('start')">
          重走长征路
          <svg viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8h21M15 1l7 7-7 7" /></svg>
        </button>
        <div class="entry-secondary">
          <button class="entry entry-resume" type="button" :disabled="!hasSave" @click="emit('resume')">
            继续前行
            <span v-if="hasSave && resumeLabel" class="resume-label">{{ resumeLabel }}</span>
          </button>
          <span class="entry-divider" aria-hidden="true"></span>
          <button class="entry" type="button" @click="emit('settings')">设置</button>
        </div>
      </nav>
    </div>
    <p class="credit">据中共中央党史研究室《中国共产党历史》整理</p>
    <div class="prologue-side" aria-hidden="true">
      <p class="era">1934<span>—</span>1936</p>
      <div class="seal"></div>
    </div>
  </section>
</template>

<style scoped>
.prologue { position: fixed; inset: 0; z-index: 9; pointer-events: none; }
.prologue-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(20, 23, 20, .96), rgba(20, 23, 20, .78) 26%, rgba(20, 23, 20, .24) 48%, transparent 66%),
    linear-gradient(0deg, rgba(20, 23, 20, .8), transparent 23%);
}
.prologue-body { position: absolute; top: 49%; left: 8.3vw; width: min(600px, 44vw); transform: translateY(-50%); }
.kicker { display: flex; align-items: center; gap: 12px; margin: 0 0 28px; color: var(--text-muted); font: 500 13px/1.7 var(--font-body); letter-spacing: .16em; }
.kicker > span { flex: none; width: 24px; height: 2px; background: var(--accent-red); }
.title { margin: 0; color: var(--text-main); font-family: var(--font-display); font-size: 72px; font-weight: 600; line-height: 1.24; letter-spacing: .055em; }
.title > span { display: block; }
.title-stop { color: var(--accent-red); }
.subtitle { margin: 29px 0 0; color: var(--text-muted); font: 400 16px/1.95 var(--font-body); letter-spacing: .04em; }
.entries {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  margin-top: 38px;
  /* Only the controls capture input; the surrounding globe remains draggable. */
  pointer-events: none;
}
.entry {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 2px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  font: 400 14px/1.5 var(--font-body);
  letter-spacing: .06em;
  cursor: pointer;
  pointer-events: auto;
  transition: color .2s ease, background-color .2s ease, border-color .2s ease;
}
.entry:hover:not(:disabled) { color: var(--text-main); }
.entry:focus-visible { outline: 2px solid var(--paper); outline-offset: 5px; }
.entry:disabled { color: #817e74; cursor: default; }
.entry-main { min-width: 210px; min-height: 56px; justify-content: space-between; gap: 34px; padding: 0 24px; border-color: rgba(255, 235, 210, .12); background: var(--accent-red); color: #fff5e7; font-weight: 500; font-size: 16px; letter-spacing: .1em; }
.entry-main:hover:not(:disabled) { background: #ba4b3a; color: #fff5e7; }
.entry-main svg { width: 23px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.2; }
.entry-secondary { display: flex; align-items: center; gap: 18px; }
.entry-divider { height: 13px; width: 1px; background: rgba(234, 226, 209, .2); }
.resume-label { color: var(--accent-gold); font-size: 12px; letter-spacing: .02em; }
.credit { position: absolute; left: 8.3vw; bottom: 38px; margin: 0; color: #a39f93; font: 400 12px/1.6 var(--font-body); letter-spacing: .025em; }
.prologue-side { position: absolute; right: 5.5vw; bottom: 42px; display: flex; align-items: center; gap: 22px; }
.era { display: flex; align-items: center; gap: 12px; margin: 0; color: var(--text-muted); font: 500 13px/1 var(--font-body); letter-spacing: .1em; }
.era span { color: var(--accent-gold); }
.seal { width: 48px; height: 48px; background: url('/seals/xinhuo.webp') center / contain no-repeat; opacity: .85; transform: rotate(-3deg); }

@media (max-width: 1600px) {
  .title { font-size: 60px; }
  .prologue-body { left: 7.5vw; }
  .credit { left: 7.5vw; }
}
@media (max-width: 1000px) {
  .prologue-body { left: 6vw; width: 48vw; }
  .title { font-size: 52px; }
  .kicker { font-size: 12px; letter-spacing: .08em; }
  .credit { left: 6vw; }
}
@media (max-width: 768px) {
  .prologue-scrim {
    background:
      linear-gradient(90deg, rgba(20, 23, 20, .88), rgba(20, 23, 20, .54) 48%, rgba(20, 23, 20, .08)),
      linear-gradient(0deg, rgba(20, 23, 20, .94), rgba(20, 23, 20, .24) 44%, rgba(20, 23, 20, .18));
  }
  .prologue-body { top: 46%; left: 7vw; width: 86vw; }
  .kicker { gap: 9px; margin-bottom: 23px; font-size: 12px; letter-spacing: .08em; }
  .kicker > span { width: 18px; }
  .title { font-size: 38px; line-height: 1.3; letter-spacing: .06em; }
  .subtitle { margin-top: 22px; font-size: 14px; line-height: 1.9; }
  .entries { margin-top: 30px; gap: 10px; }
  .entry-main { min-width: 196px; min-height: 52px; font-size: 15px; padding: 0 22px; }
  .entry-secondary { gap: 15px; }
  .credit { left: 7vw; right: 7vw; bottom: calc(26px + env(safe-area-inset-bottom, 0px)); max-width: 280px; font-size: 11px; }
  .prologue-side { right: 7vw; bottom: calc(94px + env(safe-area-inset-bottom, 0px)); }
  .era { font-size: 11px; gap: 7px; }
  .seal { width: 38px; height: 38px; }
}
@media (max-width: 420px) {
  .prologue-side { gap: 12px; }
  .entry { font-size: 13px; }
  .entry-main { font-size: 15px; }
}
@media (max-height: 650px) and (min-width: 769px) {
  .prologue-body { top: 47%; }
  .kicker { margin-bottom: 17px; }
  .title { font-size: 48px; }
  .subtitle { margin-top: 18px; font-size: 14px; }
  .entries { margin-top: 23px; gap: 7px; }
  .entry-main { min-height: 48px; }
  .credit { bottom: 20px; font-size: 11px; }
  .prologue-side { bottom: 20px; }
}
@media (max-height: 480px) and (orientation: landscape) {
  .prologue-body { top: 24px; left: 5vw; width: 56vw; transform: none; }
  .kicker { margin-bottom: 12px; font-size: 11px; }
  .title { font-size: 36px; line-height: 1.2; }
  .subtitle { margin-top: 12px; font-size: 12px; line-height: 1.6; }
  .entries { flex-direction: row; align-items: center; gap: 16px; margin-top: 18px; }
  .entry-main { min-width: 168px; min-height: 44px; padding: 0 16px; font-size: 13px; gap: 16px; }
  .entry-secondary { gap: 10px; }
  .entry { font-size: 12px; }
  .entry-resume { flex-direction: column; gap: 0; }
  .resume-label { font-size: 10px; }
  .credit { left: 5vw; bottom: 14px; max-width: none; font-size: 10px; }
  .prologue-side { right: 5vw; bottom: 14px; }
  .seal { width: 34px; height: 34px; }
}
@media (prefers-reduced-motion: reduce) { .entry { transition: none; } }
html.reduce-motion .entry { transition: none; }
</style>
