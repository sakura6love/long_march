<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  events: { type: Array, default: () => [] },
  seen: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  total: { type: Number, default: 11 },
  stationS: { type: Array, default: () => [] },
})
defineEmits(['select'])

const NUM = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾']
const num = (i) => NUM[i] || String(i + 1)

const reached = (e) => (e.at ?? 0) <= props.progress + 0.001
const lastReached = computed(() => {
  let k = -1
  props.events.forEach((e, i) => {
    if (reached(e)) k = i
  })
  return k
})

// 弧长归一化：把站点序号映射到路线真实长度的比例（滇黔段不再挤在一起）
const fracOf = (at = 0) => {
  const s = props.stationS
  if (!s || s.length < 2) return Math.max(0, Math.min(1, at / (props.total || 11)))
  const whole = Math.max(0, Math.min(s.length - 1, Math.floor(at)))
  const next = Math.min(s.length - 1, whole + 1)
  const v = s[whole] + (s[next] - s[whole]) * (at - whole)
  return Math.max(0, Math.min(1, v))
}

// 弧长定位后做最小间距松弛：真实距离不等，但标签不能叠在一起
const narrow = ref(false)
let mq = null
const onMq = (e) => { narrow.value = e.matches }
onMounted(() => {
  mq = window.matchMedia('(max-width: 768px)')
  narrow.value = mq.matches
  mq.addEventListener('change', onMq)
})
onUnmounted(() => { if (mq) mq.removeEventListener('change', onMq) })
const slots = computed(() => {
  const MIN_GAP = narrow.value ? 9.5 : 7.2
  const raw = props.events.map((e) => fracOf(e.at ?? 0) * 100)
  const out = raw.slice()
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 1; i < out.length; i += 1) {
      if (out[i] - out[i - 1] < MIN_GAP) out[i] = out[i - 1] + MIN_GAP
    }
    for (let i = out.length - 2; i >= 0; i -= 1) {
      if (out[i + 1] - out[i] < MIN_GAP) out[i] = out[i + 1] - MIN_GAP
    }
    if (out[0] < 0) { const d = -out[0]; for (let i = 0; i < out.length; i += 1) out[i] += d }
    const over = out[out.length - 1] - 100
    if (over > 0) { for (let i = 0; i < out.length; i += 1) out[i] -= over }
  }
  return props.events.map((e, i) => ({ ...e, pct: Math.max(0, Math.min(100, out[i])) }))
})

const fillPct = computed(() => fracOf(props.progress) * 100)

const hover = ref('')
const short = (date = '') => {
  const m = date.match(/(\d{4})\s*·\s*(\d{2})/)
  return m ? `${m[1]}.${m[2]}` : date
}
</script>

<template>
  <nav class="route-strip" aria-label="长征事件路书">
    <span class="rs-end rs-end-l">瑞金</span>
    <span class="rs-end rs-end-r">会宁</span>
    <div class="rs-line" aria-hidden="true">
      <span class="rs-fill" :style="{ width: `${Math.min(100, fillPct)}%` }" />
    </div>

    <button
      v-for="(e, i) in slots"
      :key="e.id"
      class="rs-node"
      :class="{
        'is-seen': reached(e),
        'is-current': i === lastReached && !activeId,
        'is-active': activeId === e.id,
        'is-locked': !reached(e),
      }"
      :style="{ left: `${e.pct}%` }"
      type="button"
      :aria-label="`${e.title}，${short(e.date)}`"
      @click.stop="$emit('select', e.id)"
      @mouseenter="hover = e.id"
      @mouseleave="hover = ''"
      @focus="hover = e.id"
      @blur="hover = ''"
    >
      <span class="rs-index">{{ num(i) }}</span>
      <span class="rs-dot" aria-hidden="true" />

      <span v-if="hover === e.id || activeId === e.id" class="rs-tip">
        <em>{{ e.title }}</em>
        <i>{{ e.place || '' }} · {{ short(e.date) }}</i>
      </span>
    </button>
  </nav>
</template>

<style scoped>
.route-strip {
  position: fixed;
  z-index: 26;
  left: 50%;
  bottom: 112px;
  width: min(760px, 56vw);
  height: 48px;
  transform: translateX(-50%);
  font-family: var(--font-body);
  pointer-events: none;
}

.rs-line {
  position: absolute;
  top: 29px;
  right: 0;
  left: 0;
  height: 1px;
  background: rgba(185, 178, 164, 0.36);
}

.rs-fill {
  position: absolute;
  inset: 0 auto 0 0;
  height: 1px;
  background: var(--accent-gold, #b99b6b);
  transition: width 600ms var(--ease);
}

.rs-node {
  position: absolute;
  top: 0;
  width: 44px;
  height: 48px;
  margin-left: -22px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted, #b9b2a4);
  cursor: pointer;
  pointer-events: auto;
}

.rs-index {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-display);
  font-size: 15px;
  line-height: 1.6;
  color: currentColor;
  white-space: nowrap;
  transition: color 180ms ease;
}

.rs-dot {
  position: absolute;
  top: 26px;
  left: 50%;
  width: 7px;
  height: 7px;
  margin-left: -3.5px;
  border: 1px solid #8e887c;
  background: var(--bg, #141714);
  transform: rotate(45deg);
  transition: background 180ms ease, border-color 180ms ease;
}

.rs-tip {
  position: absolute;
  bottom: 57px;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: max-content;
  max-width: min(260px, 70vw);
  padding: 14px 18px;
  transform: translateX(-50%);
  border: 1px solid rgba(185, 155, 107, 0.4);
  background: var(--surface, #22261f);
  color: var(--text-main, #eee7da);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  text-align: left;
  pointer-events: none;
}

.rs-tip em {
  font-family: var(--font-display);
  font-size: 19px;
  font-style: normal;
  line-height: 1.5;
}

.rs-tip i {
  color: var(--text-muted, #b9b2a4);
  font-size: 12px;
  font-style: normal;
  line-height: 1.6;
}

.rs-end {
  position: absolute;
  top: -30px;
  color: var(--text-muted, #b9b2a4);
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.16em;
}

.rs-end-l {
  left: 0;
}

.rs-end-r {
  right: 0;
}

.is-seen {
  color: var(--text-main, #eee7da);
}

.is-seen .rs-dot {
  border-color: var(--accent-red, #ac4233);
  background: var(--accent-red, #ac4233);
}

.is-current,
.is-active {
  color: var(--accent-gold, #b99b6b);
}

.is-current .rs-dot,
.is-active .rs-dot {
  border-color: var(--accent-gold, #b99b6b);
  background: var(--accent-gold, #b99b6b);
  box-shadow: 0 0 0 4px rgba(185, 155, 107, 0.15);
}

.rs-node:hover,
.rs-node:focus-visible {
  color: #fff4db;
}

.rs-node:hover .rs-dot,
.rs-node:focus-visible .rs-dot {
  border-color: var(--text-main, #eee7da);
}

.rs-node:focus-visible {
  outline: 1px solid var(--accent-gold, #b99b6b);
  outline-offset: 4px;
}

@media (max-width: 720px) {
  .route-strip {
    bottom: calc(106px + env(safe-area-inset-bottom, 0px));
    width: calc(100vw - 72px);
  }

  .rs-index {
    font-size: 14px;
  }

  .rs-end {
    top: -26px;
    font-size: 11px;
  }

  .rs-node:first-of-type .rs-tip {
    left: 0;
    transform: none;
  }

  .rs-node:last-of-type .rs-tip {
    right: 0;
    left: auto;
    transform: none;
  }
}

@media (max-width: 480px) {
  .route-strip {
    width: calc(100vw - 52px);
  }

  .rs-node {
    width: 32px;
    margin-left: -16px;
  }

  .rs-index {
    font-size: 13px;
  }

  .rs-tip {
    max-width: 220px;
    padding: 12px 14px;
  }
}

@media (max-height: 600px) and (orientation: landscape) {
  .route-strip {
    bottom: 36px;
    width: min(600px, 64vw);
  }

  .rs-end {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rs-fill,
  .rs-index,
  .rs-dot {
    transition: none;
  }
}

html.reduce-motion .rs-fill,
html.reduce-motion .rs-index,
html.reduce-motion .rs-dot {
  transition: none;
}
</style>
