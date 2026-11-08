<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  events: { type: Array, default: () => [] },
  seen: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  total: { type: Number, default: 11 },
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

// 按站点序号排布，位置与地图上的行程一致
const slots = computed(() =>
  props.events.map((e) => ({
    ...e,
    pct: Math.max(0, Math.min(1, (e.at ?? 0) / (props.total || 11))) * 100,
  })),
)

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
      <span class="rs-fill" :style="{ width: `${Math.min(100, (progress / (total || 11)) * 100)}%` }" />
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
  color: rgba(255, 255, 255, 0.5);
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
  font-size: 8.5px;
  letter-spacing: 0.04em;
  color: rgba(212, 175, 55, 0.75);
}

.rs-end {
  position: absolute;
  top: -18px;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: rgba(163, 168, 180, 0.62);
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
  color: rgba(255, 255, 255, 0.46);
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
    top: -15px;
    font-size: 8.5px;
  }
}

</style>

