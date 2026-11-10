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
    const local = localAnswer(bot.question)
    bot.raw = local.text
    bot.sources = local.sources
    bot.canRetry = true
    phase.value = 'offline'
    startPump()
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
  nextTick(() => document.querySelector('.ask-orb')?.focus())
  controller?.abort()
}

function onSubmit() {
  ask()
}

function onKeydown(event) {
  if (event.key === 'Tab' && open.value) {
    const targets = [...drawerEl().querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')]
    const first = targets[0], last = targets.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
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
      <section v-if="open" class="ask-window glass-panel" role="dialog" aria-modal="true" aria-label="史料问答">
        <header class="ask-head">
          <span class="ask-kicker">史料问答</span>
          <div class="ask-mode" role="group" aria-label="回答模式">
            <button type="button" :class="{ 'is-on': askMode === 'archive' }" @click="setMode('archive')">馆藏</button>
            <button type="button" :class="{ 'is-on': askMode === 'live' }" @click="setMode('live')">联网</button>
          </div>
          <span class="ask-status" :class="`is-${status.tone}`">
            <i class="ask-dot" />{{ status.text }}
          </span>
          <button class="ask-close" type="button" aria-label="关闭史料问答" @click="close">关闭 ×</button>
        </header>

        <p v-if="degraded" class="ask-banner">
          {{ phase === 'offline' ? '当前离线 · 读取本地馆藏' : '本地档案 · 无需网络即可阅读' }}
        </p>

        <div ref="listEl" class="ask-body">
          <div v-if="!messages.length" class="ask-intro">
            从一个问题，走近一段历史。本地回答依据展陈内容；联网回答为 AI 生成，请结合原始资料核对。
          </div>

          <div v-for="m in messages" :key="m.id" class="ask-msg" :class="`is-${m.role}`">
            <p v-if="m.role === 'user'" class="ask-text">{{ m.shown }}</p>
            <template v-else>
              <p v-if="!m.shown && busy" class="ask-thinking"><i /><i /><i /></p>
              <p v-else class="ask-text">{{ m.shown }}</p>
              <p v-if="m.sources.length && m.shown" class="ask-src">
                相关展陈 {{ m.sources.map((s) => s.label).join(' · ') }}
              </p>
              <button v-if="m.canRetry && !busy" type="button" class="ask-retry" @click="askOnline(m)">
                再问一次 · 联网
              </button>
            </template>
          </div>
        </div>

        <div v-if="!messages.length" class="ask-presets">
          <button
            v-for="item in PRESETS.slice(0, 4)"
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

    <button class="ask-orb" type="button" :aria-expanded="open" aria-label="史料问答" @click="toggle">
      <span class="ask-orb-ring" />
      <span class="ask-orb-text">史料问答</span>
    </button>
  </div>
</template>

<style scoped>
.ask{position:fixed;right:var(--page-gutter);bottom:26px;z-index:60}.ask-orb{display:flex;align-items:center;gap:12px;min-height:48px;padding:10px 22px;border:1px solid var(--accent-gold);border-radius:2px;background:var(--museum-ink);color:var(--museum-paper);font-size:15px}.ask-orb-ring{width:7px;height:7px;background:var(--accent-gold);border-radius:50%}.ask-window{position:absolute;right:0;bottom:64px;display:flex;flex-direction:column;width:460px;height:min(700px,calc(100svh - 130px));padding:26px;background:var(--museum-paper);color:var(--museum-ink);border:1px solid #c9c1b1;box-shadow:0 20px 80px #0006}.ask-head{display:flex;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid #c9c1b1;padding-bottom:14px}.ask-kicker{font:500 23px var(--font-display);flex:1}.ask-mode{display:flex;gap:4px}.ask-mode button{min-height:36px;padding:4px 10px;border:0;background:none;color:#64665e;font-size:13px}.ask-mode button.is-on{background:var(--accent-red);color:var(--museum-paper)}.ask-status{width:100%;font-size:13px;color:#66685e;order:2}.ask-dot{display:inline-block;width:5px;height:5px;margin-right:6px;border-radius:50%;background:currentColor}.ask-close{border:0;background:none;color:#5d6057;font-size:13px;min-height:44px;padding:0 4px}.ask-banner{padding:9px 12px;background:#e7decd;margin-top:12px;color:#6a493d;font-size:13px}.ask-body{flex:1;min-height:70px;overflow:auto;overscroll-behavior:contain;margin-top:20px;padding-right:4px}.ask-intro{font-size:16px;line-height:1.8;color:#64665e}.ask-msg{margin-bottom:22px}.ask-msg.is-user .ask-text{background:#e3dbcd;padding:12px;margin-left:28px}.ask-text{font-size:16px;line-height:1.9;white-space:pre-wrap}.ask-src{font-size:13px;color:#66685e;border-top:1px solid #d3cbbc;margin-top:12px;padding-top:10px}.ask-retry{font-size:13px;color:var(--accent-red);border:0;border-bottom:1px solid currentColor;background:none;padding:6px 0;min-height:40px}.ask-presets{display:flex;flex-direction:column;margin:16px 0;gap:0;max-height:210px;overflow:auto}.ask-preset{min-height:44px;padding:10px 0;text-align:left;background:none;border:0;border-bottom:1px solid #d3cbbc;font-size:14px;color:#454a3f}.ask-preset:hover{color:var(--accent-red)}.ask-input{display:flex;gap:8px;flex:none;margin-top:16px}.ask-input input{flex:1;min-width:0;height:48px;border:1px solid #9e998a;background:#faf6ed;color:var(--museum-ink);padding:0 12px;font-size:16px}.ask-input input::placeholder{color:#6e7168}.ask-input button{border:0;min-height:48px;background:var(--accent-red);color:var(--museum-paper);padding:8px 18px;font-size:15px}.ask-input button:disabled{background:#bcb3a2;color:#4b4d45}.ask-note{font-size:13px;color:#65675f;margin-top:12px}.ask-thinking{font-size:15px;color:#66685e}.ask-thinking::after{content:'正在检索…'}.ask-window-enter-active,.ask-window-leave-active{transition:opacity .2s,transform .2s}.ask-window-enter-from,.ask-window-leave-to{opacity:0;transform:translateY(10px)}
@media(max-width:768px){.ask{right:24px;bottom:18px}.ask-orb{min-height:44px;padding:8px 16px}.ask-window{width:min(460px,calc(100vw - 32px));right:-8px;bottom:58px;padding:20px;height:min(680px,calc(100svh - 110px))}.ask-kicker{font-size:21px}.ask-presets{max-height:180px}.ask-note{font-size:13px}}
</style>
