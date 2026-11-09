<script setup>
/**
 * 终章：走完十二站之后。
 * 不弹窗、不庆祝，只是一段收束文字和一枚印章 —— 像展厅出口的那面墙。
 */
defineProps({
  litCount: { type: Number, default: 12 },
})
const emit = defineEmits(['restart', 'browse'])
</script>

<template>
  <section class="finale" aria-label="终章">
    <div class="finale-veil" aria-hidden="true"></div>

    <div class="finale-body">
      <p class="era">一九三六 · 十月</p>
      <span class="rule" aria-hidden="true"></span>

      <p class="line l1">一九三四年十月，于都河畔出发。</p>
      <p class="line l2">一九三六年十月，会宁城下会师。</p>
      <p class="line l3">两年，两万五千里，十二个坐标。</p>

      <div class="seal" aria-hidden="true">长征</div>

      <div class="actions">
        <button class="act act-main" type="button" @click="emit('restart')">
          <span aria-hidden="true"></span>重走长征路
        </button>
        <button class="act" type="button" @click="emit('browse')">留在俯瞰</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.finale {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
}

.finale-veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 46%, rgba(4, 7, 12, 0.28), rgba(4, 7, 12, 0.86) 78%);
  animation: veil-in 1.4s ease both;
}

@keyframes veil-in {
  from {
    opacity: 0;
  }
}

.finale-body {
  position: relative;
  width: min(620px, 84vw);
  text-align: center;
}

.era {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: rgba(212, 175, 55, 0.6);
  animation: rise 1s cubic-bezier(0.25, 1, 0.5, 1) 0.3s both;
}

.rule {
  display: block;
  width: 40px;
  height: 1px;
  margin: 20px auto 44px;
  background: rgba(212, 175, 55, 0.35);
  animation: rise 1s cubic-bezier(0.25, 1, 0.5, 1) 0.45s both;
}

.line {
  margin: 0 0 18px;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: clamp(17px, 1.5vw, 22px);
  font-weight: 500;
  line-height: 1.75;
  letter-spacing: 0.04em;
  color: var(--text-main);
}

.l1 {
  animation: rise 1.1s cubic-bezier(0.25, 1, 0.5, 1) 0.9s both;
}
.l2 {
  animation: rise 1.1s cubic-bezier(0.25, 1, 0.5, 1) 1.5s both;
}
.l3 {
  margin-top: 30px;
  color: var(--accent-gold);
  animation: rise 1.1s cubic-bezier(0.25, 1, 0.5, 1) 2.1s both;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

.seal {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  margin: 52px auto 0;
  border: 0;
  border-radius: 0;
  background: url('/seals/changzheng.webp') center / 100% 100% no-repeat;
  color: #f0d6a8;
  font-family: 'Songti SC', 'Noto Serif SC', serif;
  font-size: 19px;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 3px rgba(52, 8, 6, 0.75);
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.45));
  animation: stamp 0.7s cubic-bezier(0.25, 1, 0.5, 1) 3s both;
}

@keyframes stamp {
  from {
    opacity: 0;
    transform: scale(1.35) rotate(-4deg);
  }
}

.actions {
  display: flex;
  justify-content: center;
  gap: 44px;
  margin-top: 64px;
  animation: rise 1s cubic-bezier(0.25, 1, 0.5, 1) 3.4s both;
}

.act {
  position: relative;
  border: 0;
  padding: 0;
  background: none;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 15px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.4s ease;
}

.act:hover {
  color: var(--text-main);
}

.act-main {
  padding-left: 20px;
  color: var(--accent-gold);
}

.act-main span {
  position: absolute;
  left: 0;
  top: 50%;
  width: 1px;
  height: 16px;
  background: var(--accent-gold);
  transform: translateY(-50%);
}

@media (max-width: 768px) {
  .actions {
    gap: 30px;
  }
  .line {
    font-size: 15px;
    line-height: 1.9;
  }
}
.finale-line{text-shadow:0 2px 22px rgba(0,0,0,.72),0 0 40px rgba(0,0,0,.5)}
</style>
