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
  bottom: 88px;
  width: min(520px, 46vw);
  height: 30px;
  transform: translateX(-50%);
  z-index: 26;
  pointer-events: none;
}

.rs-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 18px;
  height: 1px;
  background: rgba(212, 175, 55, 0.22);
}

.rs-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(139, 28, 28, 0.2), var(--red-trail));
  transition: width 0.9s cubic-bezier(0.25, 1, 0.5, 1);
}

.rs-node {
  position: absolute;
  top: 0;
  width: 20px;
  height: 30px;
  margin-left: -10px;
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
  font-size: 9px;
  letter-spacing: 0.05em;
  color: rgba(212, 175, 55, 0.45);
  transition: color 0.35s;
  white-space: nowrap;
}

.rs-dot {
  position: absolute;
  left: 50%;
  top: 12px;
  width: 2px;
  height: 9px;
  margin-left: -1px;
  background: rgba(212, 175, 55, 0.42);
  transition: all 0.35s cubic-bezier(0.25, 1, 0.5, 1);
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
  top: -16px;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: rgba(163, 168, 180, 0.55);
}
.rs-end-l { left: 0; }
.rs-end-r { right: 0; }

/* 已走过 */
.is-seen .rs-index {
  color: rgba(232, 201, 138, 0.9);
}
.is-seen .rs-dot {
  background: var(--red-trail);
  box-shadow: 0 0 6px rgba(139, 28, 28, 0.65);
}

/* 当前 */
.is-current .rs-dot,
.is-active .rs-dot {
  background: #f8df9c;
  height: 16px;
  top: 9px;
  box-shadow: 0 0 10px rgba(232, 201, 138, 0.8);
}

/* 未走到 */
.is-locked {
  opacity: 0.55;
}
.is-locked:hover {
  opacity: 0.75;
}

.rs-node:hover .rs-index {
  color: var(--text-main);
}
@media (max-width: 768px) {
  .route-strip {
    width: 86vw;
    bottom: 86px;
    height: 24px;
  }
  .rs-end {
    top: -14px;
    font-size: 8.5px;
  }
  .rs-num {
    font-size: 8px;
  }
}

</style>

