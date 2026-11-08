<script setup>
/**
 * AskPanel —— 右下角的"问一问"（现在是左下角，避开右侧详情面板）。
 *
 * 这是"预设问答"，不是自由对话：问题与答案都写死在本地，
 * 现场断网也能用，也不会把史实说错。真接大模型时，把 answers 换成一次接口请求即可。
 */
import { ref } from 'vue'

const open = ref(false)
const activeId = ref('')

const QA = [
  {
    id: 'distance',
    q: '长征一共走了多远、多久？',
    a: '中央红军 1934 年 10 月从江西于都出发，1935 年 10 月到达陕北吴起镇，历时一年，纵横十一个省，行程约二万五千里。此后红二、红四方面军继续长征，直到 1936 年 10 月三大主力会师，长征才全部结束。',
  },
  {
    id: 'zunyi',
    q: '遵义会议为什么是转折点？',
    a: '1935 年 1 月，中央红军在遵义召开政治局扩大会议，总结第五次反"围剿"和长征初期的教训，重新确立实事求是的思想路线，实际上确立了毛泽东在党中央和红军中的领导地位。此后红军四渡赤水、巧渡金沙江，重新夺回了战场主动权。',
  },
  {
    id: 'luding',
    q: '泸定桥是怎么夺下来的？',
    a: '1935 年 5 月 29 日，红四团一昼夜奔袭 240 里赶到泸定桥。桥面木板已被拆除，只剩十三根铁索。22 名突击队员冒着火力攀索冲锋，后续部队铺板跟进，最终夺下这座大渡河上唯一的通道。',
  },
  {
    id: 'snow',
    q: '翻雪山、过草地到底有多难？',
    a: '夹金山海拔 4000 多米，空气稀薄、终年积雪，许多战士穿着单衣翻越，坐下休息就可能再也起不来。草地是一片沼泽，一脚踩空便会陷下去，粮食耗尽后只能挖野菜、煮皮带。这两段路是长征中减员最严重的行程。',
  },
  {
    id: 'end',
    q: '长征结束的标志是什么？',
    a: '1936 年 10 月，红一、红二、红四方面军在甘肃会宁、静宁将台堡会师，宣告长征胜利结束。会宁因此被称为"长征会师圣地"。',
  },
]

function toggle() {
  open.value = !open.value
  activeId.value = ''
}

function pick(id) {
  activeId.value = activeId.value === id ? '' : id
}

const answerOf = (id) => QA.find((item) => item.id === id)?.a || ''
</script>

<template>
  <div class="ask">
    <Transition name="ask-window">
      <section v-if="open" class="ask-window glass-panel" aria-label="长征知识问答">
        <header class="ask-head">
          <span class="ask-kicker">ASK / 长征问答</span>
          <button class="ask-close" type="button" aria-label="收起问答" @click="toggle">
            <span aria-hidden="true"></span>
          </button>
        </header>

        <p class="ask-intro">挑一个问题，答案都经过史实核对。</p>

        <ul class="ask-list">
          <li v-for="item in QA" :key="item.id">
            <button
              class="ask-q"
              type="button"
              :class="{ 'is-open': activeId === item.id }"
              :aria-expanded="activeId === item.id"
              @click="pick(item.id)"
            >
              <span>{{ item.q }}</span>
              <i aria-hidden="true"></i>
            </button>
            <Transition name="ask-answer">
              <p v-if="activeId === item.id" class="ask-a">{{ answerOf(item.id) }}</p>
            </Transition>
          </li>
        </ul>

        <p class="ask-note">依据展陈史料整理 · 仅供了解</p>
      </section>
    </Transition>

    <button class="ask-orb" type="button" :aria-expanded="open" aria-label="打开长征问答" @click="toggle">
      <span class="ask-orb-ring" aria-hidden="true"></span>
      <span class="ask-orb-text">问</span>
    </button>
  </div>
</template>

<style scoped>
.ask {
  position: fixed;
  z-index: 30;
  bottom: 32px;
  left: 32px;
}

.ask-orb {
  position: relative;
  display: grid;
  width: 54px;
  height: 54px;
  padding: 0;
  place-items: center;
  border: 1px solid rgba(212, 175, 55, 0.42);
  border-radius: 50%;
  background: rgba(20, 25, 35, 0.62);
  box-shadow: 0 12px 30px rgba(4, 7, 12, 0.45);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  cursor: pointer;
  transition:
    border-color 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.ask-orb:hover,
.ask-orb:focus-visible,
.ask-orb[aria-expanded='true'] {
  border-color: rgba(224, 189, 114, 0.85);
  background: rgba(212, 175, 55, 0.14);
  transform: translateY(-1px);
  outline: none;
}

.ask-orb-ring {
  position: absolute;
  inset: 5px;
  border: 1px solid rgba(212, 175, 55, 0.18);
  border-radius: 50%;
}

.ask-orb-text {
  color: #e0bd72;
  font-family: 'Songti SC', 'Noto Serif SC', 'STSong', serif;
  font-size: 18px;
  letter-spacing: 0;
}

.ask-window {
  position: absolute;
  bottom: 70px;
  left: 0;
  display: flex;
  width: 348px;
  max-height: min(60vh, 520px);
  padding: 22px 22px 16px;
  flex-direction: column;
  box-sizing: border-box;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  overflow: hidden;
}

.ask-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ask-kicker {
  color: rgba(212, 175, 55, 0.85);
  font: 10px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.18em;
}

.ask-close {
  position: relative;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.ask-close span,
.ask-close span::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 1px;
  background: rgba(243, 241, 230, 0.55);
  content: '';
  transform: translate(-50%, -50%) rotate(45deg);
}

.ask-close span::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.ask-intro {
  margin: 10px 0 14px;
  color: rgba(243, 241, 230, 0.46);
  font-size: 12px;
  letter-spacing: 0.02em;
}

.ask-list {
  display: flex;
  margin: 0;
  padding: 0;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 2px;
  list-style: none;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(212, 175, 55, 0.3) transparent;
}

.ask-q {
  display: flex;
  width: 100%;
  padding: 11px 2px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: rgba(243, 241, 230, 0.76);
  font-size: 13px;
  line-height: 1.6;
  text-align: left;
  cursor: pointer;
  transition: color 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.ask-q i {
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: rgba(212, 175, 55, 0.5);
  transition: background 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.ask-q:hover,
.ask-q:focus-visible,
.ask-q.is-open {
  color: #f8df9c;
  outline: none;
}

.ask-q.is-open i {
  background: #e0bd72;
  box-shadow: 0 0 10px 2px rgba(224, 189, 114, 0.45);
}

.ask-a {
  margin: 0 0 10px;
  padding: 2px 0 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(243, 241, 230, 0.66);
  font-size: 12.5px;
  line-height: 1.95;
  text-align: justify;
}

.ask-note {
  margin: 12px 0 0;
  color: rgba(243, 241, 230, 0.28);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.ask-window-enter-active,
.ask-window-leave-active {
  transition:
    opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.ask-window-enter-from,
.ask-window-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 768px) {
  /* 手机上详情抽屉从底部升起，问答挪到右上角，两个都不打架 */
  .ask {
    top: 16px;
    right: 16px;
    bottom: auto;
    left: auto;
  }

  .ask-window {
    top: 70px;
    right: 0;
    bottom: auto;
    left: auto;
    width: min(86vw, 348px);
    max-height: 52vh;
  }
}
</style>
