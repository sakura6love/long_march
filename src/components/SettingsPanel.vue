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
  <div class="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <button class="settings-veil" type="button" aria-label="继续" @click="emit('close')"></button>

    <section class="settings-card">
      <header class="settings-head">
        <div>
          <p class="settings-kicker">观展设置 · SETTINGS</p>
          <h2 id="settings-title">设置</h2>
        </div>
        <button class="settings-x" type="button" aria-label="继续" @click="emit('close')">继续</button>
      </header>

      <div class="row">
        <span class="row-label">音效</span>
        <button
          class="switch"
          type="button"
          aria-label="音效"
          :aria-pressed="!muted"
          @click="emit('toggle-mute')"
        >
          <i :class="{ on: !muted }" aria-hidden="true"></i>
          {{ muted ? '关' : '开' }}
        </button>
      </div>

      <div class="row">
        <span class="row-label">背景音乐</span>
        <button
          class="switch"
          type="button"
          aria-label="背景音乐"
          :aria-pressed="bgm"
          @click="emit('toggle-bgm')"
        >
          <i :class="{ on: bgm }" aria-hidden="true"></i>
          {{ bgm ? '开' : '关' }}
        </button>
      </div>

      <div class="row">
        <span class="row-label">减少动效</span>
        <button
          class="switch"
          type="button"
          aria-label="减少动效"
          :aria-pressed="reduced"
          @click="emit('toggle-motion')"
        >
          <i :class="{ on: reduced }" aria-hidden="true"></i>
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
  padding: 24px;
  font-family: var(--font-body);
}

.settings button {
  font-family: inherit;
}

.settings-veil {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(12, 15, 12, 0.74);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  cursor: default;
}

.settings-card {
  position: relative;
  width: min(100%, 520px);
  max-height: calc(100dvh - 48px);
  padding: 36px 40px 30px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(185, 155, 107, 0.32);
  border-top: 2px solid var(--accent-gold);
  border-radius: 2px;
  background: var(--surface, #22261f);
  color: var(--text-main);
  box-shadow: 0 28px 100px rgba(0, 0, 0, 0.4);
  scrollbar-color: #6a6659 transparent;
  scrollbar-width: thin;
  animation: settings-in 240ms ease both;
}

@keyframes settings-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 26px;
  border-bottom: 1px solid rgba(185, 155, 107, 0.25);
}

.settings-kicker {
  margin: 0 0 9px;
  color: var(--accent-gold);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.16em;
}

.settings-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.12em;
}

.settings-x {
  flex: none;
  min-width: 72px;
  min-height: 44px;
  padding: 10px 17px;
  border: 1px solid rgba(185, 155, 107, 0.5);
  border-radius: 1px;
  background: transparent;
  color: var(--text-main);
  font-size: 13px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease;
}

.settings-x:hover {
  border-color: var(--accent-gold);
  background: rgba(185, 155, 107, 0.12);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 76px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(234, 226, 209, 0.1);
}

.row-label {
  font-size: 15px;
  line-height: 1.6;
  letter-spacing: 0.04em;
}

.switch {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 82px;
  min-height: 44px;
  padding: 6px 0 6px 8px;
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}

.switch i {
  position: relative;
  display: block;
  width: 44px;
  height: 24px;
  border: 1px solid #717367;
  border-radius: 20px;
  background: #30362c;
  transition: background 180ms ease, border-color 180ms ease;
}

.switch i::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #a7aa9c;
  transition: transform 180ms ease, background 180ms ease;
}

.switch i.on {
  border-color: var(--accent-gold);
  background: var(--accent-gold);
}

.switch i.on::after {
  transform: translateX(20px);
  background: var(--ink, #292923);
}

.switch:hover i {
  border-color: var(--paper, #eae2d1);
}

.switch[aria-pressed='true'] {
  color: var(--text-main);
}

.split {
  height: 20px;
}

.settings .restart {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 8px 0;
  border: 0;
  background: none;
  color: #dd9c86;
  font-family: var(--font-display);
  font-size: 17px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 180ms ease;
}

.restart span {
  width: 7px;
  height: 7px;
  border: 1px solid currentColor;
  transform: rotate(45deg);
}

.restart:hover {
  color: var(--text-main);
}

.restart:disabled {
  color: #929487;
  cursor: default;
}

.note {
  margin: 5px 0 0 19px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.8;
}

.settings button:focus-visible {
  outline: 2px solid var(--paper, #eae2d1);
  outline-offset: 4px;
}

@media (max-width: 768px) {
  .settings { padding: 20px; }
  .settings-card { max-height: calc(100dvh - 40px); }
}

@media (max-width: 420px) {
  .settings { padding: 16px; }
  .settings-card { max-height: calc(100dvh - 32px); padding: 26px 24px 24px; }
  .settings-head { gap: 16px; padding-bottom: 22px; }
  .settings-head h2 { font-size: 30px; }
  .settings-kicker { font-size: 9px; }
  .row { min-height: 70px; }
}

@media (max-height: 600px) {
  .settings { padding: 16px; }
  .settings-card { max-height: calc(100dvh - 32px); padding: 22px 28px; }
  .settings-head { padding-bottom: 16px; }
  .settings-head h2 { font-size: 28px; }
  .row { min-height: 60px; padding: 8px 0; }
  .split { height: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .settings *, .settings *::before, .settings *::after {
    animation: none !important;
    transition: none !important;
  }
}

:global(.reduce-motion .settings *),
:global(.reduce-motion .settings *::before),
:global(.reduce-motion .settings *::after) {
  animation: none !important;
  transition: none !important;
}
</style>
