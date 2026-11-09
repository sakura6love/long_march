<script setup>
/**
 * DetailPanel —— 选中某个历史节点后从右侧滑出的详情面板。
 *
 * 只负责"读"：不碰相机、不碰地球，所有坐标与文案都来自 props。
 * 这样面板的排版怎么改，都不会影响地图上光点的位置。
 */
import { computed, ref, watch } from 'vue'
import { STATS_URL } from '../lib/ai.js'

const props = defineProps({
  // 当前选中的节点；null 表示收起
  node: { type: Object, default: null },
  // 该节点在长征路线中的序号（从 1 开始）
  order: { type: Number, default: 0 },
  total: { type: Number, default: 12 },
  // 这一站是否已经被点亮
  lit: { type: Boolean, default: false },
  // 一共点亮了几站
  litCount: { type: Number, default: 0 },
})

const emit = defineEmits(['close', 'navigate', 'light-up'])

/** 经纬度写成"29.91°N 102.23°E"这种军用风格，比裸数字好读。 */
const coordinate = computed(() => {
  if (!props.node) return ''
  const lat = `${Math.abs(props.node.lat).toFixed(2)}°${props.node.lat >= 0 ? 'N' : 'S'}`
  const lng = `${Math.abs(props.node.lng).toFixed(2)}°${props.node.lng >= 0 ? 'E' : 'W'}`
  return `${lat} ${lng}`
})

/** 把长段落切成 2 段：取中点附近第一个句号，避免一整块文字压得人不想读。 */
const paragraphs = computed(() => {
  const text = (props.node && props.node.description) || ''
  if (text.length < 90) return text ? [text] : []
  const mid = Math.floor(text.length / 2)
  let cut = -1
  for (let d = 0; d < 120; d += 1) {
    const right = text.indexOf('。', mid + d)
    if (right > -1 && right < text.length - 20) { cut = right + 1; break }
    const left = text.lastIndexOf('。', mid - d)
    if (left > 40) { cut = left + 1; break }
  }
  if (cut < 0) return [text]
  return [text.slice(0, cut).trim(), text.slice(cut).trim()].filter(Boolean)
})

const orderLabel = computed(() =>
  props.order ? `第 ${String(props.order).padStart(2, '0')} 站 / 共 ${props.total} 站` : '',
)

function close() {
  emit('close')
}

/* 取消点亮会连带熄灭其后的站，先给一次确认机会 */
const confirming = ref(false)
let confirmTimer = 0

const laterLit = computed(() => Math.max(0, props.litCount - props.order))

const lightLabel = computed(() => {
  if (!props.lit) return '点亮此站'
  if (confirming.value) return `再点一次 · 熄灭其后 ${laterLit.value} 站`
  return '已点亮 · 点击取消'
})

function onLight() {
  if (props.lit && laterLit.value > 0 && !confirming.value) {
    confirming.value = true
    window.clearTimeout(confirmTimer)
    confirmTimer = window.setTimeout(() => {
      confirming.value = false
    }, 4000)
    return
  }

  confirming.value = false
  const turningOn = !props.lit
  emit('light-up', props.node.id)

  // 点亮上报：只升不降，后端按访客哈希去重；失败静默，不影响交互
  if (turningOn) {
    const lights = Math.max(0, Math.min(12, props.litCount + 1))
    fetch(STATS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lights }),
      keepalive: true,
    }).catch(() => {})
  }
}

watch(
  () => props.node && props.node.id,
  () => {
    confirming.value = false
  },
)
</script>

<template>
  <Transition name="detail">
    <aside
      v-if="node"
      class="detail-panel glass-panel"
      role="dialog"
      aria-label="历史节点详情"
      :aria-hidden="!node"
    >
      <button class="panel-close" type="button" aria-label="关闭详情" @click="close" />

      <header class="detail-head">
        <p class="detail-eyebrow">
          <span class="detail-order">{{ orderLabel }}</span>
          <span class="detail-date">{{ node.date }}</span>
        </p>
        <h2 class="detail-title">{{ node.name }}</h2>
        <span class="detail-rule" aria-hidden="true"></span>
        <p v-if="node.quote" class="detail-quote">{{ node.quote }}</p>
      </header>

      <div class="detail-body">
        <template v-if="node.lead">
          <p class="detail-lead">{{ node.lead }}</p>

          <section v-for="(sec, i) in node.sections" :key="i" class="detail-section">
            <h3 class="detail-subhead">{{ sec.h }}</h3>
            <p class="detail-text">{{ sec.p }}</p>
          </section>

        </template>

        <template v-else>
          <p
            v-for="(para, i) in paragraphs"
            :key="i"
            class="detail-text"
            :class="{ 'is-lead': i === 0 }"
          >
            {{ para }}
          </p>
        </template>
      </div>

      <dl v-if="node.facts && node.facts.length" class="detail-facts">
        <div v-for="(f, i) in node.facts" :key="i" class="detail-fact">
          <dd class="detail-fact-v">{{ f.v }}</dd>
          <dt class="detail-fact-k">{{ f.k }}</dt>
        </div>
      </dl>

      <button
        class="detail-light"
        :class="{ 'is-lit': lit, 'is-confirming': confirming }"
        type="button"
        @click="onLight"
      >
        <span class="detail-light-dot" aria-hidden="true"></span>
        {{ lightLabel }}
      </button>

      <footer class="detail-foot">
        <span class="detail-coordinate">{{ coordinate }}</span>
        <div class="detail-steps">
          <button
            type="button"
            class="step-btn"
            :disabled="order <= 1"
            @click="emit('navigate', -1)"
          ><span aria-hidden="true">←</span>上一站</button>
          <button
            type="button"
            class="step-btn"
            :disabled="order >= total"
            @click="emit('navigate', 1)"
          >下一站<span aria-hidden="true">→</span></button>
        </div>
      </footer>
    </aside>
  </Transition>
</template>

<style scoped>
.detail-panel {
  position: fixed;
  z-index: 34;
  top: 88px;
  right: 40px;
  display: flex;
  width: 392px;
  max-height: min(76vh, 720px);
  box-sizing: border-box;
  padding: 34px 32px 22px;
  flex-direction: column;
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
  border-color: rgba(212, 175, 55, 0.4);
  background: rgba(212, 175, 55, 0.08);
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
  margin: 0 0 16px;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: rgba(243, 241, 230, 0.44);
  font: 10px/1 'Space Mono', ui-monospace, monospace;
  letter-spacing: 0.16em;
}

.detail-order {
  color: var(--accent-gold);
}

.detail-date {
  color: rgba(243, 241, 230, 0.5);
  letter-spacing: 0.12em;
}

.detail-title {
  margin: 0;
  color: var(--text-main);
  font-family: 'Songti SC', 'Noto Serif SC', 'STSong', serif;
  font-size: 34px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.detail-rule {
  display: block;
  width: 34px;
  height: 1px;
  margin-top: 16px;
  background: linear-gradient(90deg, rgba(212, 175, 55, 0.92), rgba(212, 175, 55, 0));
}

.detail-quote {
  margin: 16px 0 0;
  padding-left: 14px;
  border-left: 1px solid rgba(212, 175, 55, 0.55);
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
  padding-right: 4px;
  padding-bottom: 18px;
  -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 16px), transparent);
  mask-image: linear-gradient(180deg, #000 calc(100% - 16px), transparent);
  scrollbar-width: thin;
  scrollbar-color: rgba(212, 175, 55, 0.35) transparent;
}

.detail-body::-webkit-scrollbar {
  width: 4px;
}

.detail-body::-webkit-scrollbar-thumb {
  border-radius: 2px;
  background: rgba(212, 175, 55, 0.32);
}

.detail-text {
  margin: 0;
  color: rgba(244, 241, 225, 0.7);
  font-size: 13.5px;
  line-height: 2;
  letter-spacing: 0.03em;
  text-align: justify;
}

.detail-text + .detail-text {
  margin-top: 14px;
}

.detail-text.is-lead {
  color: rgba(244, 241, 225, 0.88);
}

/* ---- 分节结构：导语 / 小标题 / 数据条 ---- */
.detail-lead {
  margin: 0 0 20px;
  color: rgba(244, 241, 225, 0.92);
  font-size: 14.5px;
  line-height: 1.92;
  letter-spacing: 0.035em;
}

.detail-section + .detail-section {
  margin-top: 18px;
}

.detail-subhead {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 7px;
  color: var(--accent-gold);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 400;
  letter-spacing: 0.18em;
}

.detail-subhead::before {
  content: "";
  width: 12px;
  height: 1px;
  background: rgba(212, 175, 55, 0.55);
  flex: none;
}

.detail-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  flex: none;
  margin: 16px 0 0;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.detail-fact {
  min-width: 0;
}

.detail-fact-v {
  margin: 0;
  color: rgba(248, 223, 156, 0.94);
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.detail-fact-k {
  margin: 5px 0 0;
  color: rgba(163, 168, 180, 0.62);
  font-size: 10px;
  line-height: 1.4;
  letter-spacing: 0.12em;
}

.detail-light {
  display: flex;
  width: 100%;
  height: 42px;
  margin-top: 16px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.045);
  color: rgba(244, 241, 225, 0.82);
  font-size: 12px;
  letter-spacing: 0.18em;
  cursor: pointer;
  transition:
    background 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    border-color 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    color 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.detail-light-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 10px 2px rgba(224, 189, 114, 0.5);
  transition: box-shadow 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.detail-light:hover:not(:disabled),
.detail-light:focus-visible:not(:disabled) {
  border-color: rgba(212, 175, 55, 0.45);
  background: rgba(255, 255, 255, 0.075);
  box-shadow: 0 0 18px rgba(212, 175, 55, 0.12);
  color: #f8df9c;
  outline: none;
}

.detail-light.is-lit {
  border-color: rgba(212, 175, 55, 0.42);
  background: rgba(212, 175, 55, 0.10);
  color: #f8df9c;
}

.detail-light.is-lit .detail-light-dot {
  box-shadow:
    0 0 12px 3px rgba(246, 220, 156, 0.75),
    0 0 26px 8px rgba(224, 189, 114, 0.28);
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
  border: 1px solid rgba(212, 175, 55, 0.28);
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
  background: rgba(212, 175, 55, 0.1);
  color: #f8df9c;
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
    height: auto;
    max-height: min(78vh, 660px);
    padding: 24px 20px calc(16px + env(safe-area-inset-bottom, 0px));
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
    min-height: 96px;
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
.detail-light.is-confirming {
  border-color: rgba(243, 212, 140, 0.85);
  color: #f8df9c;
  box-shadow:
    0 0 0 1px rgba(243, 212, 140, 0.25),
    0 6px 18px rgba(212, 175, 55, 0.18);
}

.detail-steps { display: flex; gap: 8px; }
.step-btn {
  min-width: 78px;
  height: 34px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid rgba(196, 163, 90, 0.24);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-main);
  font-size: 11.5px;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: border-color .35s var(--ease), background .35s var(--ease), color .35s var(--ease);
}
.step-btn:hover:not(:disabled) { border-color: rgba(229, 192, 123, 0.72); background: rgba(229, 192, 123, 0.06); color: #fff; }
.step-btn:disabled { opacity: .32; cursor: default; }

@media (max-width: 768px) {
  .detail-steps { gap: 10px; }
  .step-btn { min-width: 88px; height: 44px; font-size: 12px; }
}
</style>
