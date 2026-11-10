<script setup>
/**
 * 设置：从俯瞰态按 ESC 进入。
 * 只有四项：音效、减少动效、重走长征路、继续。
 */
defineProps({
  muted: { type: Boolean, default: false },
  bgm: { type: Boolean, default: true },
  reduced: { type: Boolean, default: false },
  canRestart: { type: Boolean, default: true },
})
const emit = defineEmits(['close', 'restart', 'toggle-mute', 'toggle-motion', 'toggle-bgm'])
</script>

<template>
  <div class="settings" role="dialog" aria-label="设置">
    <button class="settings-veil" type="button" aria-label="继续" @click="emit('close')"></button>

    <section class="settings-card glass-panel glass-panel--modal">
      <header class="settings-head">
        <h2>设 置</h2>
        <button class="settings-x" type="button" aria-label="继续" @click="emit('close')">继续</button>
      </header>

      <div class="row">
        <span class="row-label">音效</span>
        <button
          class="switch"
          type="button"
          :aria-pressed="!muted"
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
.settings {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
}

.settings-veil {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(4, 7, 12, 0.62);
  backdrop-filter: blur(2px);
  cursor: default;
}

.settings-card {
  position: relative;
  width: min(520px, 86vw);
  padding: 34px 40px 30px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  animation: settings-in 0.42s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes settings-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

.settings-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 26px;
}

.settings-head h2 {
  margin: 0;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 26px;
  font-weight: 500;
  letter-spacing: 0.3em;
  color: var(--text-main);
}

.settings-x {
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: rgba(243, 241, 230, 0.45);
  cursor: pointer;
}

.settings-x:hover {
  color: var(--text-main);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
}

.row-label {
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 14px;
  letter-spacing: 0.16em;
  color: rgba(243, 241, 230, 0.82);
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: none;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: rgba(243, 241, 230, 0.5);
  cursor: pointer;
}

.switch i {
  position: relative;
  display: block;
  width: 34px;
  height: 18px;
  border-radius: 9px;
  background: rgba(243, 241, 230, 0.12);
  box-shadow: inset 0 0 0 1px rgba(243, 241, 230, 0.18);
  transition: background 0.28s ease, box-shadow 0.28s ease;
}

.switch i::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(243, 241, 230, 0.5);
  transition: transform 0.28s cubic-bezier(0.25, 1, 0.5, 1), background 0.28s ease;
}

.switch i.on {
  background: rgba(229, 192, 123, 0.26);
  box-shadow: inset 0 0 0 1px rgba(229, 192, 123, 0.55);
}

.switch i.on::after {
  transform: translateX(16px);
  background: #e5c07b;
}

.split {
  height: 1px;
  margin: 16px 0 20px;
  background: rgba(255, 255, 255, 0.08);
}

.restart {
  position: relative;
  display: inline-flex;
  align-items: center;
  border: 0;
  padding: 0 0 0 18px;
  background: none;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 15px;
  letter-spacing: 0.18em;
  color: var(--accent-gold);
  cursor: pointer;
}

.restart span {
  position: absolute;
  left: 0;
  width: 1px;
  height: 14px;
  background: var(--accent-gold);
  transition: height 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.restart:hover span {
  height: 20px;
}

.restart:disabled {
  color: rgba(212, 175, 55, 0.3);
  cursor: default;
}

.note {
  margin: 12px 0 0 18px;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(243, 241, 230, 0.26);
}
</style>
