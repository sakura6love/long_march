<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { askAI, fetchStats, ChatError } from '../lib/ai.js'
import { contextFor, localAnswer } from '../lib/archive.js'
import { PRESETS, findPreset } from '../lib/presets.js'

const open = ref(false)
const draft = ref('')
const inputEl = ref(null)
const listEl = ref(null)
const phase = ref('idle')
const stats = ref(null)

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
  if (value) window.addEventListener('keydown', onKeydown, true)
  else window.removeEventListener('keydown', onKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  controller?.abort()
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="ask" :class="{ 'is-open': open }">
    <Transition name="ask-window">
      <section v-if="open" class="ask-window glass-panel" role="dialog" aria-label="长征问答">
        <header class="ask-head">
          <span class="ask-kicker">ASK / 长征问答</span>
          <span class="ask-status" :class="`is-${status.tone}`">
            <i class="ask-dot" />{{ status.text }}
          </span>
          <button class="ask-close" type="button" aria-label="关闭" @click="close" />
        </header>

        <p v-if="degraded" class="ask-banner">
          {{ phase === 'offline' ? '当前离线 · 读取本地馆藏' : '通讯不稳 · 已回溯本地档案' }}
        </p>

        <div ref="listEl" class="ask-body">
          <div v-if="!messages.length" class="ask-intro">
            问一件具体的事。答案只从展陈史料里取，并标出处。
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
  left: 60px;
}

.ask-orb {
  position: relative;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.34);
  background: rgba(10, 15, 24, 0.62);
  color: var(--accent-gold);
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: border-color 0.4s var(--ease), background 0.4s var(--ease);
}

.ask-orb:hover {
  border-color: rgba(212, 175, 55, 0.7);
  background: rgba(18, 26, 38, 0.78);
}

.ask-orb-ring {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.16);
}

.ask-orb-text {
  position: relative;
  font-size: 15px;
  letter-spacing: 0.1em;
}

.ask-window {
  position: absolute;
  left: 0;
  bottom: 72px;
  display: flex;
  flex-direction: column;
  width: 360px;
  max-height: min(68vh, 560px);
  padding: 20px 22px 14px;
  border-radius: 3px;
}

.ask-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.ask-kicker {
  font-size: 10px;
  letter-spacing: 0.22em;
  color: var(--accent-gold);
  opacity: 0.8;
  flex: 1;
}

.ask-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  color: rgba(163, 168, 180, 0.68);
}

.ask-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.ask-status.is-live {
  color: #8ec9a0;
}

.ask-status.is-busy {
  color: var(--accent-gold);
}

.ask-status.is-archive {
  color: #d8b06a;
}

.ask-close {
  position: relative;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.ask-close::before,
.ask-close::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 1px;
  background: rgba(244, 241, 225, 0.5);
  transition: background 0.3s var(--ease);
}

.ask-close::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.ask-close::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.ask-close:hover::before,
.ask-close:hover::after {
  background: #f4f1e1;
}

.ask-banner {
  margin: 12px 0 0;
  padding: 7px 10px;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: rgba(248, 223, 156, 0.86);
  background: rgba(212, 175, 55, 0.08);
  border-left: 1px solid rgba(212, 175, 55, 0.5);
}

.ask-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-top: 14px;
  padding-right: 4px;
  mask-image: linear-gradient(180deg, #000 calc(100% - 18px), transparent);
}

.ask-intro {
  font-size: 12px;
  line-height: 1.9;
  color: rgba(163, 168, 180, 0.72);
}

.ask-msg {
  margin-bottom: 14px;
}

.ask-msg.is-user .ask-text {
  margin-left: auto;
  width: fit-content;
  max-width: 92%;
  padding: 6px 10px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 12.5px;
  color: rgba(244, 241, 225, 0.82);
}

.ask-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.95;
  color: rgba(244, 241, 225, 0.78);
  white-space: pre-wrap;
}

.ask-src {
  margin: 7px 0 0;
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: rgba(212, 175, 55, 0.62);
}

.ask-thinking {
  display: flex;
  gap: 5px;
  margin: 4px 0 0;
}

.ask-thinking i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(212, 175, 55, 0.75);
  animation: ask-blink 1.1s var(--ease) infinite;
}

.ask-thinking i:nth-child(2) {
  animation-delay: 0.15s;
}

.ask-thinking i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes ask-blink {
  0%,
  100% {
    opacity: 0.2;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

.ask-presets {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  flex: none;
}

.ask-preset {
  text-align: left;
  padding: 7px 0;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: rgba(243, 241, 230, 0.72);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.3s var(--ease), padding-left 0.3s var(--ease);
}

.ask-preset:hover {
  color: #f4f1e1;
  padding-left: 6px;
}

.ask-input {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex: none;
}

.ask-input input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.22);
  color: #f4f1e1;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.3s var(--ease);
}

.ask-input input:focus {
  border-color: rgba(212, 175, 55, 0.5);
}

.ask-input input::placeholder {
  color: rgba(163, 168, 180, 0.5);
}

.ask-input button {
  height: 32px;
  padding: 0 14px;
  border: 1px solid rgba(212, 175, 55, 0.34);
  border-radius: 2px;
  background: rgba(212, 175, 55, 0.1);
  color: #f8df9c;
  font-size: 11.5px;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background 0.3s var(--ease), border-color 0.3s var(--ease);
}

.ask-input button:hover:not(:disabled) {
  background: rgba(212, 175, 55, 0.2);
  border-color: rgba(212, 175, 55, 0.6);
}

.ask-input button:disabled {
  opacity: 0.4;
  cursor: default;
}

.ask-retry {
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: color 0.3s var(--ease);
}

.ask-retry:hover {
  color: var(--accent-gold);
}

.ask-note {
  margin: 10px 0 0;
  font-size: 9.5px;
  letter-spacing: 0.05em;
  color: rgba(163, 168, 180, 0.42);
  flex: none;
}

.ask-window-enter-active,
.ask-window-leave-active {
  transition: opacity 0.32s var(--ease), transform 0.32s var(--ease);
}

.ask-window-enter-from,
.ask-window-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 768px) {
  .ask {
    top: 16px;
    right: 16px;
    bottom: auto;
    left: auto;
  }

  .ask-window {
    top: 70px;
    bottom: auto;
    width: min(88vw, 360px);
    max-height: 62vh;
  }
}
</style>
