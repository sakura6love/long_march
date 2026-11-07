<script setup>
defineProps({
  events: { type: Array, default: () => [] },
  seen: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
})
defineEmits(['select'])
</script>

<template>
  <aside class="event-rail" aria-label="事件回顾">
    <button
      v-for="(e, i) in events"
      :key="e.id"
      class="rail-item"
      :class="{ 'is-seen': seen.includes(e.id), 'is-active': activeId === e.id }"
      type="button"
      @click.stop="$emit('select', e.id)"
    >
      <span class="rail-mark" aria-hidden="true" />
      <span class="rail-text">
        <em>{{ String(i + 1).padStart(2, '0') }}</em>{{ e.title }}
      </span>
    </button>
  </aside>
</template>

<style scoped>
.event-rail {
  position: fixed;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 26;
  pointer-events: none;
}

.rail-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  pointer-events: auto;
}

.rail-mark {
  width: 7px;
  height: 7px;
  transform: rotate(45deg);
  border: 1px solid rgba(196, 163, 90, 0.6);
  background: transparent;
  transition: background 0.4s cubic-bezier(0.25, 1, 0.5, 1),
    border-color 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.rail-item.is-seen .rail-mark {
  background: #8b1c1c;
  border-color: rgba(196, 163, 90, 0.75);
}

.rail-item.is-active .rail-mark {
  background: #f3f1e6;
  border-color: #f3f1e6;
  box-shadow: 0 0 10px rgba(243, 241, 230, 0.5);
}

.rail-text {
  position: absolute;
  right: 18px;
  white-space: nowrap;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: rgba(243, 241, 230, 0.7);
  opacity: 0;
  transform: translateX(6px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none;
}

.rail-text em {
  font-style: normal;
  margin-right: 8px;
  color: rgba(196, 163, 90, 0.8);
  font-size: 9px;
}

.rail-item:hover .rail-text,
.rail-item.is-active .rail-text {
  opacity: 1;
  transform: translateX(0);
}
</style>
