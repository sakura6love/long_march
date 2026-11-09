<script setup>
/**
 * 序章：地球在右侧缓转，左侧是入口。
 * 不做"点击任意处进入"——必须点主入口，才有仪式感。
 */
defineProps({
  hasSave: { type: Boolean, default: false },
  resumeLabel: { type: String, default: '' },
})
const emit = defineEmits(['start', 'resume', 'settings'])
</script>

<template>
  <section class="prologue" aria-label="序章">
    <div class="prologue-scrim" aria-hidden="true"></div>

    <div class="prologue-body">
      <p class="kicker">LOW EARTH ORBIT / CN-ROUTE</p>
      <h1 class="title">长征万里 · 薪火千秋</h1>
      <p class="subtitle">1934—1936 · 十二个坐标，一条改变中国的路</p>

      <span class="rule" aria-hidden="true"></span>

      <nav class="entries">
        <button class="entry entry-main" type="button" @click="emit('start')">
          <span class="entry-line" aria-hidden="true"></span>
          重走长征路
        </button>
        <button
          class="entry"
          type="button"
          :disabled="!hasSave"
          @click="emit('resume')"
        >
          <span class="entry-line" aria-hidden="true"></span>
          继续前行
          <em v-if="hasSave && resumeLabel">{{ resumeLabel }}</em>
        </button>
        <button class="entry" type="button" @click="emit('settings')">
          <span class="entry-line" aria-hidden="true"></span>
          设置
        </button>
      </nav>

      <p class="credit">据中共中央党史研究室《中国共产党历史》整理</p>
    </div>

    <div class="prologue-side" aria-hidden="true">
      <p class="era">一九三四<span>·</span>一九三六</p>
      <div class="seal">薪火</div>
    </div>
  </section>
</template>

<style scoped>
.prologue {
  position: fixed;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  user-select: none;
}

.prologue-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(4, 7, 12, 0.94) 0%, rgba(4, 7, 12, 0.72) 34%, rgba(4, 7, 12, 0) 62%),
    linear-gradient(180deg, rgba(4, 7, 12, 0.55), rgba(4, 7, 12, 0) 30%, rgba(4, 7, 12, 0.5));
}

.prologue-body {
  position: absolute;
  left: 8vw;
  top: 50%;
  width: min(620px, 46vw);
  transform: translateY(-50%);
  /* 文字区不可拦截指针：否则左半屏的地球拖不动 */
  pointer-events: none;
}

.kicker {
  margin: 0 0 28px;
  font-size: 11px;
  letter-spacing: 0.32em;
  color: rgba(212, 175, 55, 0.62);
}

.title {
  margin: 0;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: clamp(38px, 3.6vw, 54px);
  font-weight: 500;
  letter-spacing: 0.15em;
  color: var(--text-main);
}

.subtitle {
  margin: 22px 0 0;
  font-size: 13px;
  letter-spacing: 0.22em;
  color: var(--text-muted);
}

.rule {
  display: block;
  width: 56px;
  height: 1px;
  margin: 46px 0 40px;
  background: rgba(212, 175, 55, 0.35);
}

.entries {
  /* 容器整块不拦截：否则按钮之间的缝隙也拖不动地球 */
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 22px;
}

.entry {
  pointer-events: auto;
  position: relative;
  padding: 0 0 0 0;
  border: 0;
  background: none;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 16px;
  letter-spacing: 0.18em;
  color: rgba(244, 241, 225, 0.46);
  padding-left: 0;
  cursor: pointer;
  transition: color 0.5s var(--ease), padding-left 0.5s var(--ease);
}

.entry-line {
  position: absolute;
  left: 0;
  top: 50%;
  width: 0;
  height: 1px;
  background: rgba(212, 175, 55, 0.75);
  transform: translateY(-50%);
  transform-origin: left center;
  opacity: 0;
  transition: width 0.55s var(--ease), opacity 0.35s var(--ease);
}

.entry:hover:not(:disabled),
.entry:focus-visible:not(:disabled) {
  color: var(--text-main);
  outline: none;
  padding-left: 34px;
  transition-delay: 0.06s;
}

.entry:hover:not(:disabled) .entry-line,
.entry:focus-visible:not(:disabled) .entry-line {
  width: 24px;
  opacity: 1;
}

.entry-main {
  font-size: 22px;
  color: var(--text-main);
  letter-spacing: 0.22em;
}


.entry:disabled {
  color: rgba(243, 241, 230, 0.18);
  cursor: default;
}

.entry em {
  margin-left: 10px;
  font-style: normal;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: rgba(212, 175, 55, 0.55);
}

.credit {
  margin: 64px 0 0;
  font-size: 10px;
  letter-spacing: 0.12em;
  color: rgba(243, 241, 230, 0.22);
}

.prologue-side {
  position: absolute;
  right: 6vw;
  bottom: 8vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
}

.era {
  margin: 0;
  writing-mode: vertical-rl;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 12px;
  letter-spacing: 0.42em;
  color: rgba(163, 168, 180, 0.45);
}

.era span {
  padding: 6px 0;
  color: rgba(212, 175, 55, 0.5);
}

.seal {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 0;
  background: url('/seals/xinhuo.webp') center / 100% 100% no-repeat;
  color: transparent;
  text-shadow: none;
  font-family: 'Songti SC', 'Noto Serif SC', serif;
  font-size: 13px;
  line-height: 1;
  letter-spacing: 0.16em;
  writing-mode: vertical-rl;
  text-orientation: upright;
  text-shadow: 0 1px 2px rgba(64, 12, 8, 0.65);
  filter: brightness(0.68) saturate(0.92) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.55));
  opacity: 0.92;
  cursor: pointer;
  transform: rotate(-3deg);
  transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1),
              filter 0.35s cubic-bezier(0.25, 1, 0.5, 1);
}

.seal:hover,
.seal:focus-visible {
  transform: rotate(-3deg) scale(1.05);
  filter: brightness(0.82) saturate(1) drop-shadow(0 0 12px rgba(200, 70, 45, 0.5));
  opacity: 1;
}

@media (max-width: 768px) {
  .prologue-body {
    left: 7vw;
    width: 84vw;
    top: 46%;
  }
  .title {
    font-size: 30px;
  }
  .subtitle {
    font-size: 11px;
  }
  .entry-main {
    font-size: 19px;
  }
  .prologue-side {
    right: 7vw;
    bottom: 6vh;
  }
}
</style>
