<script setup>
/**
 * DetailPanel —— 选中某个历史节点后从右侧滑出的详情面板。
 *
 * 只负责"读"：不碰相机、不碰地球，所有坐标与文案都来自 props。
 * 这样面板的排版怎么改，都不会影响地图上光点的位置。
 */
import { computed } from 'vue'

const props = defineProps({
  // 当前选中的节点；null 表示收起
  node: { type: Object, default: null },
  // 该节点在长征路线中的序号（从 1 开始）
  order: { type: Number, default: 0 },
  total: { type: Number, default: 12 },
})

const emit = defineEmits(['close', 'navigate'])

/** 经纬度写成"29.91°N 102.23°E"这种军用风格，比裸数字好读。 */
const coordinate = computed(() => {
  if (!props.node) return ''
  const lat = `${Math.abs(props.node.lat).toFixed(2)}°${props.node.lat >= 0 ? 'N' : 'S'}`
  const lng = `${Math.abs(props.node.lng).toFixed(2)}°${props.node.lng >= 0 ? 'E' : 'W'}`
  return `${lat} ${lng}`
})

const orderLabel = computed(() =>
  props.order ? `第 ${String(props.order).padStart(2, '0')} 站 / 共 ${props.total} 站` : '',
)

function close() {
  emit('close')
}
</script>

<template>
  <Transition name="detail">
    <aside
      v-if="node"
      class="detail-panel"
      role="dialog"
      aria-label="历史节点详情"
      :aria-hidden="!node"
    >
      <button class="detail-close" type="button" aria-label="关闭详情" @click="close">
        <span aria-hidden="true"></span>
      </button>

      <header class="detail-head">
        <p class="detail-eyebrow">
          <span class="detail-order">{{ orderLabel }}</span>
          <span class="detail-date">{{ node.date }}</span>
        </p>
        <h2 class="detail-title">{{ node.name }}</h2>
        <p v-if="node.quote" class="detail-quote">{{ node.quote }}</p>
      </header>

      <div class="detail-body">
        <p class="detail-text">{{ node.description }}</p>
      </div>

      <footer class="detail-foot">
        <span class="detail-coordinate">{{ coordinate }}</span>
        <div class="detail-steps">
          <button type="button" aria-label="上一站" @click="emit('navigate', -1)">←</button>
          <button type="button" aria-label="下一站" @click="emit('navigate', 1)">→</button>
        </div>
      </footer>
    </aside>
  </Transition>
</template>

<style scoped>
.detail-panel {
  position: fixed;
  z-index: 20;
  top: 88px;
  right: 40px;
  display: flex;
  width: 380px;
  max-height: calc(100vh - 176px);
  box-sizing: border-box;
  padding: 34px 32px 22px;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  background: rgba(20, 25, 35, 0.6);
  box-shadow:
    0 30px 80px rgba(4, 7, 12, 0.55),
    inset 0 1px rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  overflow: hidden;
  pointer-events: auto;
}

/* 面板顶部一条极细的金线，和画面上那条地平线呼应。 */
.detail-panel::before {
  position: absolute;
  top: 0;
  left: 32px;
  width: 56px;
  height: 1px;
  background: linear-gradient(90deg, rgba(224, 189, 114, 0.95), transparent);
  content: '';
}

.detail-close {
  position: absolute;
  top: 22px;
  right: 22px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.detail-close span,
.detail-close span::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 11px;
  height: 1px;
  background: rgba(243, 241, 230, 0.62);
  content: '';
  transform: translate(-50%, -50%) rotate(45deg);
  transition: background 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.detail-close span::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.detail-close:hover,
.detail-close:focus-visible {
  border-color: rgba(196, 163, 90, 0.4);
  background: rgba(196, 163, 90, 0.08);
  outline: none;
}

.detail-close:hover span,
.detail-close:hover span::after,
.detail-close:focus-visible span,
.detail-close:focus-visible span::after {
  background: #e0bd72;
}

.detail-head {
  padding-right: 30px;
}

.detail-eyebrow {
  display: flex;
  margin: 0 0 14px;
  align-items: baseline;
  gap: 12px;
  color: rgba(243, 241, 230, 0.44);
  font: 10px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.16em;
}

.detail-order {
  color: #c4a35a;
}

.detail-date {
  color: rgba(243, 241, 230, 0.5);
  letter-spacing: 0.08em;
}

.detail-title {
  margin: 0;
  color: #f3f1e6;
  font-family: 'Songti SC', 'Noto Serif SC', 'STSong', serif;
  font-size: 34px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.2;
}

.detail-quote {
  margin: 16px 0 0;
  padding-left: 14px;
  border-left: 1px solid rgba(196, 163, 90, 0.55);
  color: rgba(224, 189, 114, 0.86);
  font-family: 'Songti SC', 'Noto Serif SC', 'STSong', serif;
  font-size: 14px;
  letter-spacing: 0.04em;
  line-height: 1.8;
}

.detail-body {
  margin-top: 22px;
  padding-top: 20px;
  flex: 1;
  min-height: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(196, 163, 90, 0.35) transparent;
}

.detail-body::-webkit-scrollbar {
  width: 4px;
}

.detail-body::-webkit-scrollbar-thumb {
  border-radius: 2px;
  background: rgba(196, 163, 90, 0.32);
}

.detail-text {
  margin: 0;
  color: rgba(243, 241, 230, 0.72);
  font-size: 13.5px;
  line-height: 2.05;
  letter-spacing: 0.02em;
  text-align: justify;
}

.detail-foot {
  display: flex;
  margin-top: 18px;
  padding-top: 16px;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.detail-coordinate {
  color: rgba(243, 241, 230, 0.34);
  font: 10px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.12em;
}

.detail-steps {
  display: flex;
  gap: 8px;
}

.detail-steps button {
  width: 30px;
  height: 26px;
  padding: 0;
  border: 1px solid rgba(196, 163, 90, 0.28);
  border-radius: 2px;
  background: transparent;
  color: rgba(243, 241, 230, 0.62);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    border-color 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    background 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.detail-steps button:hover,
.detail-steps button:focus-visible {
  border-color: rgba(224, 189, 114, 0.7);
  background: rgba(196, 163, 90, 0.1);
  color: #f3d48c;
  outline: none;
}

/* 进场：等镜头飞到落点（约 1 秒）再滑出，别和"光点升到 30%"抢戏。 */
.detail-enter-active {
  transition:
    opacity 0.9s cubic-bezier(0.25, 1, 0.5, 1) 0.75s,
    transform 0.9s cubic-bezier(0.25, 1, 0.5, 1) 0.75s;
}

.detail-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.detail-enter-from,
.detail-leave-to {
  opacity: 0;
  transform: translateX(26px);
}

@media (max-width: 768px) {
  .detail-panel {
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: auto;
    height: 50vh;
    max-height: 50vh;
    padding: 24px 20px 16px;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 14px 14px 0 0;
    background: rgba(16, 21, 30, 0.78);
  }

  .detail-panel::before {
    top: 8px;
    left: 50%;
    width: 34px;
    height: 2px;
    border-radius: 1px;
    background: rgba(243, 241, 230, 0.18);
    transform: translateX(-50%);
  }

  .detail-title {
    font-size: 26px;
  }

  .detail-quote {
    margin-top: 12px;
    font-size: 13px;
  }

  .detail-body {
    margin-top: 16px;
    padding-top: 14px;
  }

  .detail-text {
    font-size: 14px;
    line-height: 1.95;
  }

  /* 抽屉内滚动时，最后一行淡出，提示"下面还有"。 */
  .detail-body {
    mask-image: linear-gradient(180deg, #000 calc(100% - 26px), transparent);
    -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 26px), transparent);
  }

  .detail-enter-from,
  .detail-leave-to {
    transform: translateY(40px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-enter-active,
  .detail-leave-active {
    transition-duration: 0.01ms;
    transition-delay: 0s;
  }
}
</style>
