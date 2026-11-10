<script setup>
import { nextTick, onMounted, ref } from 'vue'
const dialog = ref(null)
onMounted(() => nextTick(() => dialog.value?.querySelector('.settings-x')?.focus()))
function trapFocus(event) {
  if (event.key !== 'Tab') return
  const buttons = [...dialog.value.querySelectorAll('button:not(:disabled):not(.settings-veil)')]
  const first = buttons[0], last = buttons.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

defineProps({
  muted: { type: Boolean, default: true },
  bgm: { type: Boolean, default: false },
  reduced: { type: Boolean, default: false },
  canRestart: { type: Boolean, default: true },
})
const emit = defineEmits(['close', 'restart', 'toggle-mute', 'toggle-motion', 'toggle-bgm'])
</script>

<template>
  <div ref="dialog" @keydown="trapFocus" class="settings" role="dialog" aria-label="参观设置" aria-modal="true">
    <button class="settings-veil" tabindex="-1" type="button" aria-label="继续" @click="emit('close')"></button>

    <section class="settings-card glass-panel glass-panel--modal">
      <header class="settings-head">
        <h2>参观设置</h2>
        <button class="settings-x" type="button" aria-label="继续" @click="emit('close')">继续</button>
      </header>

      <div class="row">
        <span class="row-label">音效</span>
        <button
          class="switch"
          type="button"
          :aria-pressed="!muted"
          aria-label="音效"
          @click="emit('toggle-mute')"
        >
          <i :class="{ on: !muted }"></i>
          {{ muted ? '关' : '开' }}
        </button>
      </div>

      <div class="row">
        <span class="row-label">背景音乐</span>
        <button
          class="switch"
          type="button"
          :aria-pressed="bgm"
          aria-label="背景音乐"
          @click="emit('toggle-bgm')"
        >
          <i :class="{ on: bgm }"></i>
          {{ bgm ? '开' : '关' }}
        </button>
      </div>

      <div class="row">
        <span class="row-label">减少动效</span>
        <button
          class="switch"
          type="button"
          :aria-pressed="reduced"
          aria-label="减少动效"
          @click="emit('toggle-motion')"
        >
          <i :class="{ on: reduced }"></i>
          {{ reduced ? '开' : '关' }}
        </button>
      </div>

      <div class="split" aria-hidden="true"></div>

      <button class="restart" type="button" :disabled="!canRestart" @click="emit('restart')">
        <span aria-hidden="true"></span>重走长征路
      </button>
      <p class="note">会清空已点亮的站点，从头开始。</p>
    </section>
  </div>
</template>

<style scoped>
.settings{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:24px;overflow:auto}.settings-veil{position:absolute;inset:0;background:#12150fbb;border:0;cursor:default}.settings-card{position:relative;width:min(520px,100%);max-height:calc(100svh - 48px);overflow:auto;padding:36px;background:var(--museum-paper);color:var(--museum-ink)}.settings-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:16px}.settings-head h2{font:500 32px var(--font-display);margin:0}.settings-x{min-height:44px;background:none;border:0;color:#64665e;font-size:15px}.row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0;border-bottom:1px solid #d3cbbc}.row-label{font-size:17px}.switch{display:flex;align-items:center;gap:12px;min-height:44px;border:0;background:none;color:#565a50;font-size:15px}.switch i{position:relative;display:block;width:42px;height:24px;border-radius:15px;background:#b6b4a7;transition:background .2s}.switch i::after{content:'';position:absolute;top:4px;left:4px;width:16px;height:16px;border-radius:50%;background:#fff9ed;transition:transform .2s}.switch i.on{background:var(--accent-red)}.switch i.on::after{transform:translateX(18px)}.split{margin:20px 0}.restart{min-height:48px;border:1px solid var(--accent-red);background:none;color:var(--accent-red);padding:10px 18px;font-size:16px}.note{color:#65675f;margin-top:12px;font-size:14px}.restart:disabled{opacity:.5}@media(max-width:480px){.settings-card{padding:24px}.settings-head h2{font-size:28px}}
</style>
