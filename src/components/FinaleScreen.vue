<script setup>
defineProps({
  litCount: { type: Number, default: 12 },
})
const emit = defineEmits(['restart', 'browse'])
</script>

<template>
  <section class="finale" aria-labelledby="finale-title">
    <header class="finale-header"><p>长征万里 · 薪火千秋</p><span>终章</span></header>
    <div class="finale-main">
      <div class="finale-body">
        <p class="finale-kicker">山河为证 · 信念如炬</p>
        <h1 id="finale-title" class="finale-title">征途有终，<br>薪火不息。</h1>
        <span class="finale-rule" aria-hidden="true"></span>
        <p class="finale-copy">回望来路，继续理解长征的历史与精神。</p>
        <p class="finale-subcopy">你可以重新启程，或返回路线，重访沿途的历史章节。</p>
        <div class="finale-actions" aria-label="继续参观">
          <button class="finale-action finale-action-primary" type="button" @click="emit('restart')">重新启程<span aria-hidden="true">↗</span></button>
          <button class="finale-action finale-action-secondary" type="button" @click="emit('browse')">返回路线导览<span aria-hidden="true">→</span></button>
        </div>
      </div>
    </div>
    <footer class="finale-footer"><span>长征主题数字展馆</span><span>从山河之间，读懂一段征途。</span></footer>
  </section>
</template>

<style scoped>
.finale {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: #f2ebdd;
  color: #181a17;
  font-family: var(--font-body);
  font-size: 18px;
}
.finale-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px 26px; margin: 0 clamp(24px, 4.2vw, 80px); padding: 29px 0; border-bottom: 1px solid rgba(24, 26, 23, .2); }
.finale-header p { margin: 0; font-family: var(--font-display); font-size: 22px; letter-spacing: .1em; }
.finale-header > span { color: #6a5f4f; font-size: 14px; letter-spacing: .18em; }
.finale-main { flex: 1; display: grid; place-items: center; padding: 76px 24px 86px; }
.finale-body { width: min(840px, 100%); text-align: center; }
.finale-kicker { margin: 0 0 31px; color: #746046; font-size: 14px; letter-spacing: .2em; }
.finale-title { margin: 0; font-family: var(--font-display); font-size: clamp(48px, calc(3.33vw + 24px), 88px); font-weight: 400; line-height: 1.3; letter-spacing: .06em; }
.finale-rule { display: block; width: 44px; height: 2px; margin: 32px auto; background: #a6362b; }
.finale-copy { margin: 0; color: #46443b; font-size: inherit; line-height: 1.9; letter-spacing: .05em; }
.finale-subcopy { margin: 13px auto 0; max-width: 560px; color: #6c6559; font-size: 15px; line-height: 1.9; }
.finale-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 18px 24px; margin-top: 42px; }
.finale-action { display: inline-flex; justify-content: space-between; align-items: center; gap: 36px; min-height: 56px; padding: 14px 25px; border: 1px solid; border-radius: 0; font: inherit; font-size: 16px; line-height: 1.6; letter-spacing: .05em; cursor: pointer; transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease; }
.finale-action > span { font-family: var(--font-body); font-size: 21px; line-height: 1; }
.finale-action-primary { border-color: #a6362b; background: #a6362b; color: #f2ebdd; }
.finale-action-primary:hover { border-color: #b33b2f; background: #b33b2f; }
.finale-action-secondary { border-color: #8b8273; background: transparent; color: #38392f; }
.finale-action-secondary:hover { border-color: #181a17; background: #e7dfd0; color: #181a17; }
.finale-action:focus-visible { outline: 2px solid #a6362b; outline-offset: 6px; }
.finale-footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px 24px; margin: 0 clamp(24px, 4.2vw, 80px); padding: 24px 0; border-top: 1px solid rgba(24, 26, 23, .2); color: #6c6559; font-size: 13px; line-height: 1.8; letter-spacing: .04em; }
@media (max-width: 1600px) {
  .finale { font-size: 17px; }
  .finale-header p { font-size: 20px; }
}
@media (max-width: 800px) {
  .finale { font-size: 16px; }
  .finale-header { padding: 23px 0; }
  .finale-header p { font-size: 18px; letter-spacing: .06em; }
  .finale-main { padding: 62px 26px 70px; }
  .finale-kicker { margin-bottom: 27px; font-size: 13px; letter-spacing: .12em; }
  .finale-title { font-size: 48px; }
  .finale-rule { margin: 28px auto; }
  .finale-copy { max-width: 360px; margin: 0 auto; }
  .finale-subcopy { max-width: 330px; font-size: 14px; }
  .finale-actions { gap: 15px; margin-top: 32px; }
  .finale-action { min-height: 54px; font-size: 16px; padding: 13px 22px; gap: 26px; }
}
@media (max-width: 420px) {
  .finale-header p { font-size: 17px; }
  .finale-title { font-size: 42px; }
  .finale-actions { flex-direction: column; align-items: stretch; max-width: 270px; margin-right: auto; margin-left: auto; }
  .finale-footer { flex-direction: column; gap: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .finale *, .finale *::before, .finale *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
</style>
