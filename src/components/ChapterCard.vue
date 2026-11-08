<template>
  <div class="chapter-layer">
    <!-- 全屏压暗 + 章卡 -->
    <Transition name="card">
      <section v-if="chapter" class="chapter-card" :key="chapter.id">
        <p class="chapter-no">第 {{ cn(chapter.index) }} 章</p>
        <h2 class="chapter-name">{{ chapter.name }}</h2>
        <p class="chapter-date">{{ chapter.date }}</p>
        <p class="chapter-line">{{ chapter.line }}</p>
      </section>
    </Transition>

    <!-- 右下角分段进度：四段，当前段亮 -->
    <div class="rail" aria-hidden="true">
      <span
        v-for="c in CHAPTERS"
        :key="c.id"
        class="rail-seg"
        :class="{ 'is-done': progress >= c.range[1], 'is-now': progress > c.range[0] && progress < c.range[1] }"
      ></span>
    </div>
  </div>
</template>

<script setup>
import { CHAPTERS } from '../lib/chapters.js'

defineProps({
  chapter: { type: Object, default: null },
  progress: { type: Number, default: 0 },
})

const CN = ['零', '一', '二', '三', '四']
function cn(n) {
  return CN[n] || String(n)
}
</script>

<style scoped>
.chapter-layer {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9000;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.chapter-card {
  position: absolute;
  top: 13vh;
  left: 50%;
  width: min(560px, 78vw);
  transform: translateX(-50%);
  padding: 24px 28px 26px;
  text-align: center;
  border-top: 1px solid rgba(212, 175, 55, 0.45);
  border-bottom: 1px solid rgba(212, 175, 55, 0.18);
  background: linear-gradient(180deg, rgba(8, 11, 18, 0.86), rgba(8, 11, 18, 0.45));
  backdrop-filter: blur(8px);
}

.chapter-no {
  margin: 0;
  font: 11px/1 'Noto Serif SC', serif;
  letter-spacing: 0.3em;
  color: rgba(212, 175, 55, 0.85);
}

.chapter-name {
  margin: 18px 0 0;
  font: 44px/1.1 'Noto Serif SC', serif;
  letter-spacing: 0.16em;
  color: #f0e9db;
}

.chapter-date {
  margin: 10px 0 0;
  font: 12px/1 'Noto Serif SC', serif;
  letter-spacing: 0.2em;
  color: rgba(243, 241, 230, 0.5);
}

.chapter-line {
  margin: 22px 0 0;
  font: 15px/2 'Noto Serif SC', serif;
  color: rgba(235, 228, 214, 0.86);
}

.rail {
  position: absolute;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
}

.rail-seg {
  width: 46px;
  height: 1px;
  background: rgba(243, 241, 230, 0.16);
  transition: background 0.6s cubic-bezier(0.25, 1, 0.5, 1);
}

.rail-seg.is-now {
  background: rgba(212, 175, 55, 0.9);
}

.rail-seg.is-done {
  background: rgba(176, 48, 28, 0.7);
}

.card-enter-active,
.card-leave-active {
  transition: opacity 0.7s cubic-bezier(0.25, 1, 0.5, 1), transform 0.7s cubic-bezier(0.25, 1, 0.5, 1);
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (max-width: 768px) {
  .chapter-card {
    left: 50%;
    right: auto;
    width: 86vw;
    margin-top: 22px;
    max-width: none;
    padding: 22px 20px 24px;
  }

  .chapter-name {
    font-size: 32px;
  }

  .rail {
    right: 20px;
    bottom: 22px;
    gap: 6px;
  }

  .rail-seg {
    width: 32px;
  }
}
</style>

