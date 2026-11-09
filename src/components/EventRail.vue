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
  <div class="route-strip" aria-label="路书">
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
      @click.stop="$emit('select', e.id)"
      @mouseenter="hover = e.id"
      @mouseleave="hover = ''"
    >
      <span class="rs-index">{{ num(i) }}</span>
      <span class="rs-dot" aria-hidden="true" />

      <span v-if="hover === e.id || activeId === e.id" class="rs-tip">
        <em>{{ e.title }}</em>
        <i>{{ e.place || '' }} · {{ short(e.date) }}</i>
      </span>
    </button>
  </div>
</template>

<style scoped>
.route-strip {
  position: fixed;
  left: 50%;
  bottom: 108px;
  width: min(540px, 48vw);
  height: 34px;
  transform: translateX(-50%);
  z-index: 26;
  pointer-events: none;
}

.rs-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 20px;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}

.rs-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(212, 175, 55, 0.15), var(--accent-gold));
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.35);
  transition: width 0.9s var(--ease);
}

.rs-node {
  position: absolute;
  top: 0;
  width: 24px;
  height: 34px;
  margin-left: -12px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  pointer-events: auto;
}

.rs-index {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-family: inherit;
  font-size: 12px;
  line-height: 1;
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.68);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.75);
  transition: color 0.35s var(--ease), text-shadow 0.35s var(--ease);
  white-space: nowrap;
}

.rs-dot {
  position: absolute;
  left: 50%;
  top: 14px;
  width: 1px;
  height: 8px;
  margin-left: -0.5px;
  background: rgba(255, 255, 255, 0.32);
  transition: height 0.35s var(--ease), background 0.35s var(--ease), box-shadow 0.35s var(--ease);
}

.rs-tip {
  position: absolute;
  left: 50%;
  bottom: 30px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 10px;
  width: max-content;
  max-width: 190px;
  background: rgba(8, 12, 18, 0.92);
  border: 1px solid rgba(212, 175, 55, 0.3);
  backdrop-filter: blur(6px);
  white-space: nowrap;
}

.rs-tip em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-main);
}

.rs-tip i {
  font-style: normal;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: rgba(243, 241, 230, 0.5);
}

.rs-end {
  position: absolute;
  top: -18px;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--text-dim);
}
.rs-end-l { left: 0; }
.rs-end-r { right: 0; }

/* 已走过 */
.is-seen .rs-index {
  color: rgba(244, 241, 225, 0.72);
}
.is-seen .rs-dot {
  height: 12px;
  background: var(--red-trail);
  box-shadow: 0 0 6px rgba(139, 28, 28, 0.55);
}

/* 当前 */
.is-current .rs-index,
.is-active .rs-index {
  color: var(--accent-gold);
  text-shadow: 0 0 6px rgba(212, 175, 55, 0.42);
}

.is-current .rs-dot,
.is-active .rs-dot {
  background: #f8df9c;
  height: 18px;
  top: 9px;
  box-shadow:
    0 0 0 1px rgba(248, 223, 156, 0.35),
    0 0 10px rgba(232, 201, 138, 0.65);
}

/* 未走到：不再叠 opacity，只压颜色 */
.is-locked .rs-index {
  color: rgba(255, 255, 255, 0.52);
}
.is-locked .rs-dot {
  background: rgba(255, 255, 255, 0.26);
}
.is-locked:hover .rs-index {
  color: rgba(255, 255, 255, 0.78);
}

.rs-node:hover .rs-index {
  color: var(--text-main);
}
@media (max-width: 768px) {
  .route-strip {
    width: 88vw;
    bottom: calc(106px + env(safe-area-inset-bottom, 0px));
    height: 30px;
  }
  .rs-index {
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .rs-end {
    display: none;
  }
}

</style>

