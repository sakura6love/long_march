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
      class="detail-panel"
      role="dialog"
      aria-labelledby="detail-title"
      :aria-hidden="!node"
    >
      <button class="detail-close" type="button" aria-label="关闭详情" @click="close" />

      <div class="detail-scroll" tabindex="0" aria-label="站点档案内容">
        <header class="detail-head">
          <p class="detail-order">{{ orderLabel }}</p>
          <h2 id="detail-title" class="detail-title">{{ node.name }}</h2>
          <p class="detail-date">{{ node.date }}</p>
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
            <p v-for="(para, i) in paragraphs" :key="i" class="detail-text" :class="{ 'is-lead': i === 0 }">
              {{ para }}
            </p>
          </template>
        </div>

        <dl v-if="node.facts && node.facts.length" class="detail-facts">
          <div v-for="(f, i) in node.facts" :key="i" class="detail-fact">
            <dt class="detail-fact-k">{{ f.k }}</dt>
            <dd class="detail-fact-v">{{ f.v }}</dd>
          </div>
        </dl>
      </div>

      <div class="detail-actions">
        <button
          class="detail-light"
          :class="{ 'is-lit': lit, 'is-confirming': confirming }"
          type="button"
          @click="onLight"
        >
          <span class="detail-light-dot" aria-hidden="true" />
          {{ lightLabel }}
        </button>
        <footer class="detail-foot">
          <span class="detail-coordinate">{{ coordinate }}</span>
          <div class="detail-steps">
            <button type="button" class="step-btn" :disabled="order <= 1" @click="emit('navigate', -1)">
              <span aria-hidden="true">←</span>上一站
            </button>
            <button type="button" class="step-btn" :disabled="order >= total" @click="emit('navigate', 1)">
              下一站<span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.detail-panel {
  --focus-color: var(--accent-red, #ac4233);
  color-scheme: light;
  position: fixed;
  z-index: 34;
  top: 88px;
  right: clamp(24px, 3vw, 64px);
  display: flex;
  flex-direction: column;
  width: clamp(390px, 29vw, 460px);
  max-height: min(calc(100dvh - 152px), 810px);
  overflow: hidden;
  border: 1px solid rgba(41, 41, 35, 0.18);
  border-top: 3px solid var(--accent-red, #ac4233);
  background: var(--paper, #eae2d1);
  color: var(--ink, #292923);
  box-shadow: 0 20px 64px rgba(0, 0, 0, 0.22);
  font-family: var(--font-body);
  pointer-events: auto;
}

.detail-close {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 12px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid rgba(41, 41, 35, 0.16);
  border-radius: 50%;
  background: var(--paper, #eae2d1);
  color: var(--ink, #292923);
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease;
}

.detail-close::before,
.detail-close::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 1px;
  background: currentColor;
  content: '';
  transform: translate(-50%, -50%) rotate(45deg);
}

.detail-close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.detail-close:hover {
  border-color: var(--accent-red, #ac4233);
  background: #f4ecdc;
}

.detail-scroll {
  flex: 1 1 auto;
  min-height: 0;
  padding: 30px 30px 24px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  scrollbar-width: thin;
  scrollbar-color: #aaa18e transparent;
}

.detail-head {
  padding-right: 24px;
}

.detail-order {
  margin: 0 0 20px;
  color: var(--accent-red, #ac4233);
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.14em;
}

.detail-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(34px, 2.4vw, 42px);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.05em;
}

.detail-date {
  margin: 10px 0 0;
  color: var(--paper-muted, #686255);
  font-size: 13px;
  line-height: 1.7;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
}

.detail-quote {
  margin: 22px 0 0;
  padding-left: 14px;
  border-left: 2px solid var(--accent-gold, #b99b6b);
  color: #6d503e;
  font-family: var(--font-display);
  font-size: 17px;
  line-height: 1.85;
}

.detail-body {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid rgba(41, 41, 35, 0.17);
}

.detail-text,
.detail-lead {
  margin: 0;
  font-size: 17px;
  line-height: 1.95;
  overflow-wrap: anywhere;
}

.detail-lead {
  margin-bottom: 25px;
  font-family: var(--font-display);
  font-size: 19px;
  line-height: 1.8;
}

.detail-section + .detail-section,
.detail-text + .detail-text {
  margin-top: 22px;
}

.detail-subhead {
  margin: 0 0 8px;
  color: var(--accent-red, #ac4233);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1.8;
}

.detail-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 28px 0 0;
  padding-top: 20px;
  border-top: 1px solid rgba(41, 41, 35, 0.17);
}

.detail-fact {
  min-width: 0;
}

.detail-fact + .detail-fact {
  padding-left: 12px;
  border-left: 1px solid rgba(41, 41, 35, 0.12);
}

.detail-fact-k {
  color: var(--paper-muted, #686255);
  font-size: 12px;
  line-height: 1.6;
}

.detail-fact-v {
  margin: 8px 0 0;
  color: var(--ink, #292923);
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.detail-actions {
  flex: 0 0 auto;
  padding: 18px 26px 14px;
  border-top: 1px solid rgba(41, 41, 35, 0.18);
  background: #e4dac6;
}

.detail-light {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  border: 1px solid var(--accent-red, #ac4233);
  background: var(--accent-red, #ac4233);
  color: #fff7e9;
  font: 500 15px/1.6 var(--font-body);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 180ms ease, color 180ms ease;
}

.detail-light-dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: currentColor;
}

.detail-light:hover {
  background: #93372a;
}

.detail-light.is-lit {
  background: transparent;
  color: #913a2e;
}

.detail-light.is-lit:hover,
.detail-light.is-confirming {
  background: #f0d8c8;
  color: #7d2c22;
}

.detail-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 10px;
  margin-top: 10px;
}

.detail-coordinate {
  color: var(--paper-muted, #686255);
  font-size: 11px;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
}

.detail-steps {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.step-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 78px;
  min-height: 44px;
  padding: 6px;
  border: 0;
  background: transparent;
  color: var(--ink, #292923);
  font: 13px/1.6 var(--font-body);
  cursor: pointer;
  transition: color 180ms ease, background 180ms ease;
}

.step-btn:hover:not(:disabled) {
  background: rgba(172, 66, 51, 0.08);
  color: #913a2e;
}

.step-btn:disabled {
  color: #9a9283;
  cursor: default;
}

.detail-close:focus-visible,
.detail-light:focus-visible,
.step-btn:focus-visible,
.detail-scroll:focus-visible {
  outline: 2px solid #913a2e;
  outline-offset: -3px;
}

.detail-enter-active,
.detail-leave-active {
  transition: opacity 300ms ease, transform 350ms cubic-bezier(0.25, 1, 0.5, 1);
}

.detail-enter-from,
.detail-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

@media (max-width: 720px) {
  .detail-panel {
    top: auto;
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom, 0px));
    left: 12px;
    width: auto;
    max-height: 80dvh;
  }

  .detail-scroll {
    padding: 26px 24px 24px;
  }

  .detail-title {
    font-size: 34px;
  }

  .detail-actions {
    padding: 14px 20px 10px;
  }

  .detail-enter-from,
  .detail-leave-to {
    transform: translateY(20px);
  }
}

@media (max-width: 420px) {
  .detail-scroll {
    padding-right: 20px;
    padding-left: 20px;
  }

  .detail-coordinate {
    flex-basis: 100%;
  }

  .detail-foot {
    gap: 0;
  }

  .detail-steps {
    width: 100%;
    justify-content: space-between;
  }

  .detail-facts {
    gap: 8px;
  }

  .detail-fact + .detail-fact {
    padding-left: 8px;
  }

  .detail-fact-v {
    font-size: 18px;
  }
}

@media (max-height: 600px) and (min-width: 721px) {
  .detail-panel {
    top: 16px;
    bottom: 16px;
    right: 16px;
    width: min(440px, 52vw);
    max-height: calc(100dvh - 32px);
  }

  .detail-scroll {
    padding-top: 22px;
  }

  .detail-order {
    margin-bottom: 12px;
  }

  .detail-title {
    font-size: 30px;
  }

  .detail-actions {
    padding-top: 12px;
    padding-bottom: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-enter-active,
  .detail-leave-active,
  .detail-close,
  .detail-light,
  .step-btn {
    transition: none;
  }
}

html.reduce-motion .detail-enter-active,
html.reduce-motion .detail-leave-active,
html.reduce-motion .detail-close,
html.reduce-motion .detail-light,
html.reduce-motion .step-btn {
  transition: none;
}
</style>
