<script setup>
import { ref } from 'vue'

defineProps({
  hasSave: { type: Boolean, default: false },
  resumeLabel: { type: String, default: '' },
})
const emit = defineEmits(['start', 'resume', 'settings', 'browse'])
const imageFailed = ref(false)
</script>

<template>
  <section class="prologue" aria-labelledby="prologue-title">
    <div class="prologue-art" aria-hidden="true">
      <img
        v-if="!imageFailed"
        class="prologue-image"
        src="/events/jiajin.webp"
        alt=""
        width="2400"
        height="1350"
        fetchpriority="high"
        decoding="async"
        @error="imageFailed = true"
      />
    </div>
    <header class="prologue-header">
      <a class="brand" href="#prologue-title" aria-label="长征万里，薪火千秋，返回序厅">
        <span>长征万里 · 薪火千秋</span><small>长征主题数字展馆</small>
      </a>
      <nav class="prologue-nav" aria-label="展馆导航">
        <a class="nav-item is-current" href="#prologue-title" aria-current="page">序厅</a>
        <button class="nav-item" type="button" @click="emit('start')">路线导览</button>
        <button class="nav-item" type="button" @click="emit('browse')">章节展陈</button>
      </nav>
      <button class="settings-button" type="button" @click="emit('settings')">设置</button>
    </header>
    <div class="prologue-main">
      <div class="prologue-body">
        <p class="kicker"><span aria-hidden="true"></span>纪念长征胜利九十周年</p>
        <h1 id="prologue-title" class="title"><span>长征万里</span><span>薪火千秋</span></h1>
        <p class="subtitle">从山河之间，读懂一段征途。</p>
        <div class="entries" aria-label="参观入口">
          <button class="entry entry-main" type="button" @click="emit('start')"><span>启程 · 重走长征</span><span class="entry-arrow" aria-hidden="true">↗</span></button>
          <button class="entry entry-secondary" type="button" @click="emit('browse')">浏览章节<span aria-hidden="true">→</span></button>
        </div>
        <button v-if="hasSave" class="resume-entry" type="button" @click="emit('resume')">
          继续上次参观<span v-if="resumeLabel">{{ resumeLabel }}</span><span aria-hidden="true">→</span>
        </button>
      </div>
      <p class="side-note" aria-hidden="true">山河为证<span></span>信念如炬</p>
    </div>
    <footer class="prologue-footer">
      <p>山河之间，一同回望长征。</p>
      <p class="image-credit">夹金山氛围示意 · AI 生成，非历史实拍<a href="/events/jiajin.webp" target="_blank" rel="noopener noreferrer">查看原图<span class="sr-only">（在新窗口打开）</span></a></p>
    </footer>
  </section>
</template>

<style scoped>
.prologue {
  position: relative;
  z-index: 9;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
  width: 100%;
  color: #f2ebdd;
  background: #181a17;
  font-family: var(--font-body);
  font-size: 18px;
}
.prologue-art { position: absolute; inset: 0; z-index: 0; overflow: hidden; background: #181a17; }
.prologue-image { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 63% center; opacity: .78; }
.prologue-art::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(24, 26, 23, .97) 0%, rgba(24, 26, 23, .81) 33%, rgba(24, 26, 23, .16) 76%), linear-gradient(180deg, rgba(24, 26, 23, .55), transparent 32%, transparent 65%, rgba(24, 26, 23, .86));
}
.prologue-header, .prologue-main, .prologue-footer { position:relative; z-index:1; }
.prologue-header { display: flex; align-items: center; justify-content: space-between; gap: 32px; margin: 0 clamp(24px, 4.2vw, 80px); padding: 27px 0 25px; border-bottom: 1px solid rgba(242, 235, 221, .22); }
.brand { flex-shrink: 0; color: #f2ebdd; font-family: var(--font-display); font-size: 22px; line-height: 1.5; letter-spacing: .12em; text-decoration: none; }
.brand small { display: block; margin-top: 5px; font-family: var(--font-body); font-size: 13px; letter-spacing: .2em; color: #b69a66; }
.prologue-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 40px; margin-left: auto; }
.nav-item { display: inline-flex; align-items: center; min-height: 44px; padding: 9px 0; border: 0; border-bottom: 1px solid transparent; border-radius: 0; background: transparent; color: #d3cfc4; font: inherit; font-size: 15px; letter-spacing: .1em; text-decoration: none; white-space: nowrap; cursor: pointer; transition: color 180ms ease, border-color 180ms ease; }
.nav-item:hover, .nav-item.is-current { color: #f2ebdd; border-bottom-color: #b69a66; }
.settings-button { min-height: 44px; padding: 9px 0 9px 30px; border: 0; border-left: 1px solid rgba(242, 235, 221, .26); border-radius: 0; color: #e0d8c9; background: transparent; font: inherit; font-size: 15px; cursor: pointer; }
.settings-button:hover { color: #fff8eb; }
.prologue-main { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 40px; width: min(1664px, 84%); margin: 0 auto; padding: clamp(64px, 7.2vh, 110px) 0 80px; }
.prologue-body { min-width: 0; }
.kicker { display: flex; align-items: center; gap: 16px; margin: 0 0 30px; color: #b69a66; font-size: 15px; letter-spacing: .2em; }
.kicker > span { width: 34px; height: 1px; background: currentColor; }
.title { margin: 0; color: #f2ebdd; font-family: var(--font-display); font-size: clamp(48px, calc(5vw + 16px), 112px); font-weight: 400; line-height: 1.2; letter-spacing: .06em; scroll-margin-top: 24px; }
.title > span { display: block; }
.subtitle { margin: 31px 0 0; color: #dfd8c9; font-size: inherit; line-height: 1.9; letter-spacing: .1em; }
.entries { display: flex; flex-wrap: wrap; gap: 18px 30px; align-items: center; margin-top: 45px; }
.entry { display: inline-flex; justify-content: space-between; align-items: center; gap: 32px; min-height: 58px; padding: 15px 26px; border: 1px solid transparent; border-radius: 0; font: inherit; font-size: 16px; line-height: 1.6; letter-spacing: .08em; cursor: pointer; transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease; }
.entry-main { background: #a6362b; border-color: #a6362b; color: #f2ebdd; }
.entry-main:hover { background: #b33b2f; border-color: #b33b2f; }
.entry-arrow { font-size: 22px; font-family: var(--font-body); line-height: 1; }
.entry-secondary { padding-right: 0; padding-left: 0; color: #e0d8c9; background: transparent; border-bottom-color: rgba(242, 235, 221, .42); }
.entry-secondary:hover { color: #fff8eb; border-bottom-color: #b69a66; }
.resume-entry { display: flex; flex-wrap: wrap; align-items: center; gap: 11px; min-height: 44px; margin-top: 20px; padding: 7px 0; border: 0; border-radius: 0; background: transparent; color: #ded5c5; font: inherit; font-size: 14px; letter-spacing: .03em; text-align: left; cursor: pointer; }
.resume-entry > span { color: #b69a66; }
.resume-entry:hover { color: #fff8eb; }
.side-note { flex-shrink: 0; display: flex; align-items: center; gap: 20px; writing-mode: vertical-rl; font-family: var(--font-display); font-size: 16px; color: #f2ebdd; letter-spacing: .3em; text-shadow: 0 1px 12px #181a17; }
.side-note > span { width: 1px; height: 56px; background: #b69a66; }
.prologue-footer { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 16px 30px; margin: 0 clamp(24px, 4.2vw, 80px); padding: 24px 0 27px; border-top: 1px solid rgba(242, 235, 221, .22); color: #d5cdbf; font-size: 13px; line-height: 1.8; letter-spacing: .04em; }
.prologue-footer p { margin: 0; }
.image-credit { display: flex; flex-wrap: wrap; gap: 5px 18px; }
.image-credit a { color: #ded6c7; text-decoration-thickness: 1px; text-underline-offset: 5px; }
.image-credit a:hover { color: #fff8eb; }
.prologue :is(a, button):focus-visible { outline: 2px solid #b69a66; outline-offset: 6px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@media (max-width: 1600px) {
  .prologue { font-size: 17px; }
  .brand { font-size: 20px; }
  .prologue-nav { gap: 32px; }
}
@media (max-width: 1000px) {
  .prologue-header { gap: 22px; flex-wrap: wrap; padding-top: 22px; padding-bottom: 18px; }
  .brand { flex: 1; }
  .prologue-nav { order: 3; width: 100%; margin: 0; gap: 32px; }
  .settings-button { padding-left: 24px; }
  .prologue-main { width: 86%; }
}
@media (max-width: 800px) {
  .prologue { font-size: 16px; }
  .prologue-image { object-position: 60% center; }
  .prologue-art::after { background: linear-gradient(90deg, rgba(24, 26, 23, .92), rgba(24, 26, 23, .5)), linear-gradient(180deg, rgba(24, 26, 23, .35), transparent 40%, rgba(24, 26, 23, .82)); }
  .prologue-main { width: auto; margin: 0 7%; padding: 64px 0 72px; }
  .title { font-size: 48px; letter-spacing: .08em; }
  .kicker { font-size: 13px; letter-spacing: .12em; gap: 12px; margin-bottom: 27px; }
  .kicker > span { width: 26px; }
  .subtitle { margin-top: 26px; letter-spacing: .04em; }
  .entries { margin-top: 35px; gap: 16px 26px; }
  .entry { min-height: 54px; font-size: 16px; padding: 13px 21px; gap: 24px; }
  .entry-secondary { padding-right: 0; padding-left: 0; }
  .side-note { display: none; }
  .prologue-footer { padding-top: 20px; padding-bottom: 23px; gap: 10px; }
}
@media (max-width: 420px) {
  .prologue-header { margin-right: 22px; margin-left: 22px; gap: 16px; }
  .brand { font-size: 17px; letter-spacing: .06em; }
  .brand small { font-size: 13px; letter-spacing: .08em; }
  .settings-button { padding-left: 14px; font-size: 14px; }
  .prologue-nav { gap: 25px; }
  .nav-item { font-size: 14px; }
  .prologue-main { margin: 0 26px; padding-top: 50px; padding-bottom: 58px; }
  .title { font-size: 44px; }
  .entries { align-items: flex-start; flex-direction: column; gap: 12px; }
  .entry-main { min-width: 230px; }
  .entry-secondary { min-height: 48px; }
  .prologue-footer { margin-right: 22px; margin-left: 22px; }
}
@media (prefers-reduced-motion: reduce) {
  .prologue *, .prologue *::before, .prologue *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
</style>
