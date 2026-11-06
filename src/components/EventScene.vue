<script setup>
/**
 * 事件场景：一张虚化的历史影像垫在星球下方，一段叙事文字压在左下角。
 *
 * 为什么不做"居中卡片 + 大红边框"：那是海报的做法。
 * 影像是环境、文字是字幕——所以文字压在暗部，不加框，只留一条 1px 金线。
 */
defineProps({
  event: { type: Object, default: null },
})

defineEmits(['skip', 'quit'])
</script>

<template>
  <Transition name="scene">
    <div v-if="event" class="event-scene">
      <div class="event-copy">
        <p class="event-date">{{ event.date }}</p>
        <span class="event-rule" aria-hidden="true" />
        <h2 class="event-title">{{ event.title }}</h2>
        <p class="event-text">{{ event.text }}</p>

        <!-- 四渡赤水：四条虚线画在卡片里，而不是球面上（球面间距不到 3px） -->
        <svg v-if="event.diagram" class="event-diagram" viewBox="0 0 320 96" aria-hidden="true">
          <defs>
            <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 0 L6 3 L0 6 z" fill="rgba(196,163,90,0.75)" />
            </marker>
          </defs>
          <g fill="none" stroke="rgba(196,163,90,0.55)" stroke-width="1" stroke-dasharray="4 3">
            <path d="M18 78 C 60 78, 62 26, 104 26" marker-end="url(#arrow)" />
            <path d="M104 26 C 146 26, 148 78, 190 78" marker-end="url(#arrow)" />
            <path d="M190 78 C 232 78, 234 40, 276 40" marker-end="url(#arrow)" />
            <path d="M276 40 C 300 40, 300 16, 312 16" marker-end="url(#arrow)" />
          </g>
          <g fill="rgba(196,163,90,0.85)" font-size="10" font-family="Noto Serif SC, serif">
            <text x="22" y="94">① 土城</text>
            <text x="108" y="18">② 太平渡</text>
            <text x="194" y="94">③ 茅台</text>
            <text x="250" y="34">④ 二郎滩</text>
          </g>
        </svg>

        <p class="event-credit">{{ event.credit }}</p>
      </div>

      <div class="event-actions">
        <button type="button" @click.stop="$emit('skip')">跳过本段</button>
        <button type="button" @click.stop="$emit('quit')">结束播放</button>
      </div>

      <p class="event-continue" aria-hidden="true">点击继续</p>
    </div>
  </Transition>
</template>

<style scoped>
.event-scene {
  position: fixed;
  inset: 0;
  z-index: 7;
  pointer-events: none;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
}

.event-copy {
  position: absolute;
  left: 8vw;
  bottom: 15vh;
  width: 560px;
  max-width: 72vw;
  color: #e9e2d4;
}

.event-date {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.26em;
  color: #c4a35a;
}

.event-rule {
  display: block;
  width: 44px;
  height: 1px;
  margin: 16px 0 18px;
  background: #c4a35a;
  opacity: 0.5;
}

.event-title {
  margin: 0;
  font-size: 34px;
  line-height: 1.25;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.event-text {
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 2.02;
  color: rgba(232, 226, 212, 0.86);
}

.event-diagram {
  display: block;
  width: 320px;
  height: 96px;
  margin-top: 24px;
  opacity: 0.9;
}

.event-credit {
  margin: 26px 0 0;
  font-size: 10px;
  line-height: 1.6;
  color: rgba(243, 241, 230, 0.38);
}

.event-actions {
  position: absolute;
  top: 34px;
  right: 34px;
  display: flex;
  gap: 18px;
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: auto;
}

.event-scene:hover .event-actions,
.event-actions:focus-within {
  opacity: 1;
}

.event-actions button {
  padding: 0;
  border: 0;
  background: none;
  color: rgba(243, 241, 230, 0.5);
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.18em;
  cursor: pointer;
  transition: color 0.3s ease;
}

.event-actions button:hover {
  color: #e9e2d4;
}

.event-continue {
  position: absolute;
  right: 8vw;
  bottom: 15vh;
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.26em;
  color: rgba(243, 241, 230, 0.5);
  animation: continue-breathe 2.4s ease-in-out infinite;
}

@keyframes continue-breathe {
  0%,
  100% {
    opacity: 0.22;
  }
  50% {
    opacity: 0.7;
  }
}

/* 进场：文字延迟 0.35s，上浮 8px；不做缩放 */
.scene-enter-active .event-copy,
.scene-enter-active .event-continue {
  transition:
    opacity 0.8s ease 0.35s,
    transform 0.8s cubic-bezier(0.25, 1, 0.5, 1) 0.35s;
}

.scene-enter-from .event-copy,
.scene-enter-from .event-continue {
  opacity: 0;
  transform: translateY(8px);
}

.scene-leave-active .event-copy,
.scene-leave-active .event-continue {
  transition: opacity 0.45s ease;
}

.scene-leave-to .event-copy,
.scene-leave-to .event-continue {
  opacity: 0;
}

@media (max-width: 768px) {
  .event-copy {
    left: 24px;
    right: 24px;
    bottom: 12vh;
    width: auto;
    max-width: none;
  }

  .event-title {
    font-size: 26px;
  }

  .event-text {
    font-size: 14px;
    line-height: 1.95;
  }

  .event-continue {
    right: auto;
    left: 24px;
    bottom: 5vh;
  }

  .event-actions {
    top: auto;
    bottom: 5vh;
    right: 24px;
    opacity: 1;
  }
}
</style>
