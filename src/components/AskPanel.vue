<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { askAI, fetchStats, ChatError } from '../lib/ai.js'
import { contextFor, localAnswer } from '../lib/archive.js'
import { PRESETS, findPreset } from '../lib/presets.js'

const open = ref(false)
const emit = defineEmits(['update:open'])
const draft = ref('')
const inputEl = ref(null)
const listEl = ref(null)
const phase = ref('idle')
const stats = ref(null)
const askMode = ref('archive')
function setMode(mode) {
  askMode.value = mode
  try { localStorage.setItem('march:askMode', mode) } catch { /* 忽略隐私模式 */ }
}

/** @type {import('vue').Ref<Array<{id:number,role:'user'|'bot',raw:string,shown:string,sources:Array,weak:boolean}>>} */
const messages = ref([])


const STATUS = {
  idle: { text: '待提问', tone: 'idle' },
  thinking: { text: '检索中', tone: 'busy' },
  streaming: { text: '在线', tone: 'live' },
  online: { text: '在线', tone: 'live' },
  preset: { text: '馆藏', tone: 'archive' },
  archive: { text: '档案模式', tone: 'archive' },
  offline: { text: '离线', tone: 'archive' },
}

const status = computed(() => STATUS[phase.value] || STATUS.idle)
const busy = computed(() => phase.value === 'thinking' || phase.value === 'streaming')
const degraded = computed(() => phase.value === 'archive' || phase.value === 'offline')
const placeholder = computed(() => (open.value ? '问一个关于长征的问题…' : '与长征对话'))

let raf = 0
let controller = null
let seq = 0

function scrollToEnd() {
  nextTick(() => {
    const el = listEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function pump() {
  raf = 0
  const bot = messages.value.find((m) => m.role === 'bot' && m.shown.length < m.raw.length)
  if (!bot) return
  const remain = bot.raw.length - bot.shown.length
  const step = Math.max(1, Math.ceil(remain / 9))
  bot.shown = bot.raw.slice(0, bot.shown.length + step)
  scrollToEnd()
  raf = requestAnimationFrame(pump)
}

function startPump() {
  if (!raf) raf = requestAnimationFrame(pump)
}

function reset() {
  messages.value = []
  draft.value = ''
  phase.value = 'idle'
}

async function ask(text, mode = 'free') {
  const question = String(text ?? draft.value).trim()
  if (!question || busy.value) return

  draft.value = ''
  messages.value.push({
    id: (seq += 1),
    role: 'user',
    raw: question,
    shown: question,
    sources: [],
    weak: false,
  })

  /** @type {any} */
  const bot = {
    id: (seq += 1),
    role: 'bot',
    question,
    raw: '',
    shown: '',
    sources: [],
    weak: false,
    canRetry: false,
  }
  messages.value.push(bot)
  scrollToEnd()

  // L0：点预设 → 直接给馆藏答案，零网络。
  const preset = mode === 'preset' ? findPreset(question) : null
  if (preset) {
    phase.value = 'preset'
    bot.raw = preset.a
    bot.sources = [{ label: preset.label, name: '' }]
    startPump()
    return
  }

  // 联网模式：直接走 L2 流式，失败自动回落档案
  if (askMode.value === 'live') {
    bot.canRetry = true
    await askOnline(bot)
    return
  }

  // L1：自由提问 → 先给本地档案答案（<30ms），需要更深再点「联网」。
  const local = localAnswer(question)
  bot.raw = local.text
  bot.sources = local.sources
  bot.weak = local.weak
  bot.canRetry = true
  phase.value = 'archive'
  startPump()
}

// L2：用户主动点「再问一次 · 联网」才打网络。
async function askOnline(bot) {
  if (!bot || busy.value) return
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (offline) {
    phase.value = 'offline'
    return
  }

  bot.raw = ''
  bot.shown = ''
  bot.sources = []
  bot.canRetry = false
  phase.value = 'thinking'
  scrollToEnd()

  controller = new AbortController()
  let received = false

  try {
    await askAI({
      question: bot.question,
      context: contextFor(bot.question),
      signal: controller.signal,
      onDelta: (delta) => {
        if (!received) {
          received = true
          phase.value = 'streaming'
        }
        bot.raw += delta
        startPump()
      },
    })
    // 在线答案也补出处：用本地检索已算好的来源，不依赖模型自觉
    const grounded = localAnswer(bot.question)
    bot.sources = grounded.sources
    phase.value = 'online'
    startPump()
  } catch (error) {
    if (error instanceof ChatError && error.code === 'aborted') {
      phase.value = 'idle'
      return
    }
    // 失败不弹错：退回馆藏原文，并把「联网」按钮还回去。
    const local = localAnswer(bot.question)
    bot.raw = local.text
    bot.sources = local.sources
    bot.canRetry = true
    phase.value = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'archive'
    startPump()
  } finally {
    controller = null
    scrollToEnd()
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => inputEl.value?.focus())
    if (!stats.value) {
      fetchStats().then((data) => {
        if (data) stats.value = data
      })
    }
  }
}

function close() {
  open.value = false
  controller?.abort()
}

function onSubmit() {
  ask()
}

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close()
  }
}

watch(open, (value) => {
  emit('update:open', value)
  document.body.style.overflow = value ? 'hidden' : ''
  if (value) {
    pushAskHistory()
    window.addEventListener('keydown', onKeydown, true)
  } else {
    if (historyPushed) {
      historyPushed = false
      try { history.back() } catch (error) { /* ignore */ }
    }
    resetKeyboardLayout()
    window.removeEventListener('keydown', onKeydown, true)
  }
})

/** 键盘弹出时把抽屉顶上去（iOS 只改 visualViewport，不改 window.innerHeight）。 */
function drawerEl() {
  return document.querySelector('.ask-window')
}

/** 键盘弹出时把抽屉压进可见视口（安卓 Chrome / WebView 通用）。 */
function isFinePointer() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function applyKeyboardLayout() {
  const el = drawerEl()
  if (!el || !open.value) return
  // 桌面（鼠标指针）没有软键盘，这套视口贴合只该在触屏上跑；
  // 否则聚焦输入框会把面板强行改成 top 定位，桌面版式被打乱。
  if (isFinePointer()) {
    resetKeyboardLayout()
    return
  }
  const vv = window.visualViewport
  const height = vv ? vv.height : window.innerHeight
  const top = (vv ? vv.offsetTop : 0) + 8
  el.style.top = `${top}px`
  el.style.height = `${Math.min(560, Math.max(300, height - 96))}px`
  el.style.maxHeight = 'none'
  el.style.bottom = 'auto'
}

function resetKeyboardLayout() {
  const el = drawerEl()
  if (!el) return
  el.style.top = ''
  el.style.height = ''
  el.style.bottom = ''
  el.style.maxHeight = ''
}

function isInAskInput(node) {
  return Boolean(node && node.closest && node.closest('.ask-input'))
}

function onFocusIn(event) {
  if (!isInAskInput(event.target)) return
  if (isFinePointer()) return
  applyKeyboardLayout()
  window.setTimeout(applyKeyboardLayout, 120)
  window.setTimeout(applyKeyboardLayout, 360)
}

function onFocusOut() {
  window.setTimeout(() => {
    if (!isInAskInput(document.activeElement)) resetKeyboardLayout()
  }, 160)
}

/** 安卓返回键：第一次返回先关抽屉，而不是退出页面。 */
let historyPushed = false
function pushAskHistory() {
  if (historyPushed) return
  try {
    history.pushState({ ask: 1 }, '')
    historyPushed = true
  } catch (error) {
    historyPushed = false
  }
}
function onPopState() {
  if (!historyPushed) return
  historyPushed = false
  close()
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('march:askMode')
    if (saved === 'live' || saved === 'archive') askMode.value = saved
  } catch { /* 忽略 */ }
  window.addEventListener('focusin', onFocusIn)
  window.addEventListener('focusout', onFocusOut)
  window.addEventListener('popstate', onPopState)
  window.visualViewport?.addEventListener('resize', applyKeyboardLayout)
  window.visualViewport?.addEventListener('scroll', applyKeyboardLayout)
})

onBeforeUnmount(() => {
  window.removeEventListener('focusin', onFocusIn)
  window.removeEventListener('focusout', onFocusOut)
  window.removeEventListener('popstate', onPopState)
  window.visualViewport?.removeEventListener('resize', applyKeyboardLayout)
  window.visualViewport?.removeEventListener('scroll', applyKeyboardLayout)
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown, true)
  controller?.abort()
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="ask" :class="{ 'is-open': open }">
    <Transition name="ask-window">
      <section v-if="open" class="ask-window" role="dialog" aria-labelledby="ask-title">
        <header class="ask-head">
          <div class="ask-heading">
            <span class="ask-kicker">馆藏咨询 · ARCHIVE</span>
            <h2 id="ask-title">与长征对话</h2>
          </div>
          <button class="ask-close" type="button" aria-label="关闭长征问答" @click="close" />
          <div class="ask-controls">
            <div class="ask-mode" role="group" aria-label="回答模式">
              <button type="button" :class="{ 'is-on': askMode === 'archive' }" :aria-pressed="askMode === 'archive'" @click="setMode('archive')">馆藏</button>
              <button type="button" :class="{ 'is-on': askMode === 'live' }" :aria-pressed="askMode === 'live'" @click="setMode('live')">联网</button>
            </div>
            <span class="ask-status" :class="`is-${status.tone}`" aria-live="polite">
              <i class="ask-dot" aria-hidden="true" />{{ status.text }}
            </span>
          </div>
        </header>

        <p v-if="degraded" class="ask-banner">
          {{ phase === 'offline' ? '当前离线 · 读取本地馆藏' : '通讯不稳 · 已回溯本地档案' }}
        </p>

        <div ref="listEl" class="ask-body">
          <div v-if="!messages.length" class="ask-intro">
            问一件具体的事。答案只从展陈史料里取，并标出处。
          </div>

          <div v-if="!messages.length" class="ask-presets">
            <button
              v-for="item in PRESETS"
              :key="item.q"
              type="button"
              class="ask-preset"
              @click="ask(item.q, 'preset')"
            >
              {{ item.q }}
            </button>
          </div>

          <div v-for="m in messages" :key="m.id" class="ask-msg" :class="`is-${m.role}`">
            <p v-if="m.role === 'user'" class="ask-text">{{ m.shown }}</p>
            <template v-else>
              <p v-if="!m.shown && busy" class="ask-thinking"><i /><i /><i /></p>
              <p v-else class="ask-text">{{ m.shown }}</p>
              <p v-if="m.sources.length && m.shown" class="ask-src">
                出处 {{ m.sources.map((s) => s.label).join(' · ') }}
              </p>
              <button v-if="m.canRetry && !busy" type="button" class="ask-retry" @click="askOnline(m)">
                再问一次 · 联网
              </button>
            </template>
          </div>
        </div>


        <form class="ask-input" @submit.prevent="onSubmit">
          <input
            ref="inputEl"
            v-model="draft"
            type="text"
            maxlength="200"
            :placeholder="placeholder"
            :disabled="busy"
            aria-label="输入问题"
          />
          <button type="submit" :disabled="busy || !draft.trim()">发送</button>
        </form>

        <p class="ask-note">
          依据展陈史料整理 · 仅供了解<template v-if="stats && stats.available">
            · {{ stats.asks }} 次提问 · {{ stats.lights }} 站被点亮</template>
        </p>
      </section>
    </Transition>

    <button class="ask-orb" type="button" :aria-expanded="open" aria-label="长征问答" @click="toggle">
      <span class="ask-orb-ring" />
      <span class="ask-orb-text">问</span>
    </button>
  </div>
</template>

<style scoped>
.ask {
  position: fixed;
  z-index: 30;
  bottom: 32px;
  left: clamp(28px, 4.17vw, 80px);
  font-family: var(--font-body);
}

.ask button,
.ask input {
  font-family: inherit;
}

.ask-orb {
  position: relative;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  padding: 0;
  border: 1px solid rgba(185, 155, 107, 0.6);
  border-radius: 50%;
  background: var(--surface, #22261f);
  color: var(--text-main);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
}

.ask-orb:hover,
.is-open .ask-orb {
  background: var(--accent-red);
  border-color: var(--accent-red);
}

.ask-orb:hover {
  transform: translateY(-2px);
}

.ask-orb-ring {
  position: absolute;
  inset: 5px;
  border: 1px solid rgba(234, 226, 209, 0.2);
  border-radius: 50%;
  pointer-events: none;
}

.ask-orb-text {
  font-family: var(--font-display);
  font-size: 23px;
  line-height: 1;
}

.ask-window {
  position: absolute;
  left: 0;
  bottom: 74px;
  display: flex;
  flex-direction: column;
  width: 420px;
  max-width: calc(100vw - 56px);
  max-height: min(72dvh, 680px);
  padding: 26px 28px 20px;
  overflow: hidden;
  border: 1px solid #c5bba8;
  border-top: 3px solid var(--accent-red);
  border-radius: 2px;
  background: var(--paper, #eae2d1);
  color: var(--ink, #292923);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
}

.ask-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 18px 12px;
  flex: none;
}

.ask-kicker {
  display: block;
  color: var(--paper-muted, #6c665a);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.16em;
  line-height: 1.6;
}

.ask-heading h2 {
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.3;
}

.ask-controls {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(41, 41, 35, 0.2);
}

.ask-mode {
  display: inline-flex;
  padding: 3px;
  border: 1px solid rgba(41, 41, 35, 0.22);
  border-radius: 2px;
  background: rgba(41, 41, 35, 0.035);
}

.ask-mode button {
  min-width: 64px;
  min-height: 36px;
  padding: 6px 14px;
  border: 0;
  border-radius: 1px;
  background: transparent;
  color: var(--paper-muted, #6c665a);
  font-size: 13px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color 180ms ease, background 180ms ease;
}

.ask-mode button:hover {
  color: var(--ink, #292923);
  background: rgba(41, 41, 35, 0.06);
}

.ask-mode button.is-on {
  color: var(--paper, #eae2d1);
  background: var(--ink, #292923);
}

.ask-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--paper-muted, #6c665a);
  font-size: 12px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.ask-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.ask-status.is-live {
  color: #496044;
}

.ask-status.is-busy {
  color: var(--accent-red);
}

.ask-close {
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid rgba(41, 41, 35, 0.22);
  border-radius: 50%;
  background: transparent;
  color: var(--ink, #292923);
  cursor: pointer;
  transition: background 180ms ease;
}

.ask-close::before,
.ask-close::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 1px;
  background: currentColor;
}

.ask-close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.ask-close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.ask-close:hover {
  background: rgba(41, 41, 35, 0.08);
}

.ask-banner {
  flex: none;
  margin: 14px 0 0;
  padding: 9px 12px;
  border-left: 2px solid var(--accent-red);
  background: rgba(172, 66, 51, 0.06);
  color: #794234;
  font-size: 12px;
  line-height: 1.65;
}

.ask-body {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 18px;
  padding-right: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: #b7ad9c transparent;
  scrollbar-width: thin;
}

.ask-intro {
  color: var(--paper-muted, #6c665a);
  font-size: 14px;
  line-height: 1.85;
}

.ask-presets {
  display: flex;
  flex-direction: column;
  margin-top: 16px;
}

.ask-preset {
  position: relative;
  min-height: 44px;
  padding: 12px 24px 12px 0;
  border: 0;
  border-top: 1px solid rgba(41, 41, 35, 0.14);
  background: transparent;
  color: var(--ink, #292923);
  font-size: 14px;
  line-height: 1.6;
  text-align: left;
  cursor: pointer;
  transition: color 180ms ease, padding-left 180ms ease;
}

.ask-preset::after {
  content: '↗';
  position: absolute;
  right: 2px;
  top: 50%;
  color: var(--accent-red);
  transform: translateY(-50%);
}

.ask-preset:hover {
  padding-left: 5px;
  color: var(--accent-red);
}

.ask-msg {
  margin-bottom: 22px;
}

.ask-text {
  margin: 0;
  color: var(--ink, #292923);
  font-size: 15px;
  line-height: 1.95;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.ask-msg.is-user .ask-text {
  width: fit-content;
  max-width: 94%;
  margin-left: auto;
  padding: 10px 13px;
  border-left: 2px solid var(--accent-red);
  background: rgba(172, 66, 51, 0.075);
  font-weight: 500;
  line-height: 1.8;
}

.ask-src {
  margin: 12px 0 0;
  padding-left: 10px;
  border-left: 1px solid #a58f6c;
  color: var(--paper-muted, #6c665a);
  font-size: 11px;
  line-height: 1.8;
}

.ask-thinking {
  display: flex;
  gap: 6px;
  margin: 8px 0 0;
  padding: 8px 0;
}

.ask-thinking i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent-red);
  animation: ask-blink 1.1s ease infinite;
}

.ask-thinking i:nth-child(2) {
  animation-delay: 0.15s;
}

.ask-thinking i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes ask-blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.ask-input {
  display: flex;
  gap: 8px;
  flex: none;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(41, 41, 35, 0.2);
}

.ask-input input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 12px;
  border: 1px solid #b3a996;
  border-radius: 1px;
  background: #f4eee3;
  color: var(--ink, #292923);
  font-size: 16px;
  transition: border-color 180ms ease;
}

.ask-input input::placeholder {
  color: var(--paper-muted, #6c665a);
  font-size: 13px;
}

.ask-input input:focus {
  border-color: var(--accent-red);
}

.ask-input button {
  flex: none;
  min-width: 64px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--accent-red);
  border-radius: 1px;
  background: var(--accent-red);
  color: #fff6e9;
  font-size: 14px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 180ms ease;
}

.ask-input button:hover:not(:disabled) {
  background: #8d3428;
}

.ask-input button:disabled {
  border-color: #bbb09c;
  background: #c9bfad;
  color: #666052;
  cursor: default;
}

.ask-retry {
  min-height: 40px;
  margin-top: 4px;
  padding: 6px 0;
  border: 0;
  background: none;
  color: var(--accent-red);
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
}

.ask-retry:hover {
  color: #7f3025;
}

.ask-note {
  flex: none;
  margin: 12px 0 0;
  color: var(--paper-muted, #6c665a);
  font-size: 10px;
  line-height: 1.65;
}

.ask button:focus-visible,
.ask input:focus-visible {
  outline: 2px solid var(--accent-red);
  outline-offset: 3px;
}

.ask-orb:focus-visible {
  outline-color: var(--paper, #eae2d1);
}

.ask-preset:focus-visible,
.ask-retry:focus-visible {
  outline-offset: -2px;
}

.ask-window-enter-active,
.ask-window-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.ask-window-enter-from,
.ask-window-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 768px) {
  .ask {
    right: 16px;
    left: auto;
    bottom: calc(16px + env(safe-area-inset-bottom));
  }

  .ask-orb {
    width: 52px;
    height: 52px;
  }

  .ask-window {
    position: fixed;
    top: auto;
    left: 12px;
    right: 12px;
    bottom: calc(84px + env(safe-area-inset-bottom));
    width: auto;
    max-width: none;
    max-height: min(72dvh, 620px, calc(100dvh - 112px - env(safe-area-inset-bottom)));
    padding: 22px 24px 16px;
  }
}

@media (max-width: 420px) {
  .ask-window { padding: 18px 18px 14px; }
  .ask-head { gap: 14px 10px; }
  .ask-heading h2 { font-size: 25px; }
  .ask-controls { padding-bottom: 12px; }
  .ask-body { margin-top: 14px; }
  .ask-input { padding-top: 12px; margin-top: 12px; }
}

@media (max-height: 600px) {
  .ask { bottom: calc(12px + env(safe-area-inset-bottom)); }
  .ask-orb { width: 44px; height: 44px; }
  .ask-window {
    bottom: calc(68px + env(safe-area-inset-bottom));
    max-height: calc(100dvh - 84px - env(safe-area-inset-bottom));
    padding: 14px 20px 12px;
  }
  .ask-head { gap: 8px 10px; }
  .ask-heading h2 { margin-top: 4px; font-size: 24px; }
  .ask-kicker { font-size: 9px; }
  .ask-controls { padding-bottom: 8px; }
  .ask-mode button { min-height: 32px; }
  .ask-body { margin-top: 10px; }
  .ask-input { padding-top: 10px; margin-top: 10px; }
  .ask-note { margin-top: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .ask *, .ask *::before, .ask *::after {
    animation: none !important;
    transition: none !important;
  }
}

:global(.reduce-motion .ask *),
:global(.reduce-motion .ask *::before),
:global(.reduce-motion .ask *::after) {
  animation: none !important;
  transition: none !important;
}
</style>
