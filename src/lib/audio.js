/**
 * 极轻的声音层：全部用 WebAudio 合成，不加载任何音频文件。
 *
 * 设计原则：
 *  - 环境音是"低频的风"，音量极低（0.012），只为让展厅不显得死寂；
 *  - 交互音都很短（点燃 260ms、翻页 90ms、点击 40ms），不抢戏；
 *  - 浏览器要求首次用户交互后才能启动 AudioContext，这里用 ensure() 惰性启动。
 */
const STORAGE_KEY = 'march:muted'

let ctx = null
let master = null
let ambientGain = null
let muted = false

try {
  muted = localStorage.getItem(STORAGE_KEY) === '1'
} catch {
  muted = false
}

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  ctx = new AudioCtx()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 1
  master.connect(ctx.destination)
  return ctx
}

/** 环境音：低通过滤的噪声 + 缓慢起伏，像高空的风。 */
function startAmbient() {
  const c = ensure()
  if (!c || ambientGain) return
  const buffer = c.createBuffer(1, c.sampleRate * 4, c.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.2
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  src.loop = true

  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 220
  filter.Q.value = 0.6

  ambientGain = c.createGain()
  ambientGain.gain.value = 0
  ambientGain.gain.linearRampToValueAtTime(0.05, c.currentTime + 6)

  // 缓慢起伏：让风"呼吸"
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.06
  const lfoGain = c.createGain()
  lfoGain.gain.value = 0.012
  lfo.connect(lfoGain).connect(ambientGain.gain)
  lfo.start()

  src.connect(filter).connect(ambientGain).connect(master)
  src.start()
}

function noiseBurst({ duration = 0.26, from = 900, to = 180, gain = 0.18, type = 'lowpass' }) {
  const c = ensure()
  if (!c || muted) return
  const len = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i += 1) {
    const env = 1 - i / len
    data[i] = (Math.random() * 2 - 1) * env * env
  }
  const src = c.createBufferSource()
  src.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.setValueAtTime(from, c.currentTime)
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), c.currentTime + duration)

  const g = c.createGain()
  g.gain.value = gain

  src.connect(filter).connect(g).connect(master)
  src.start()
}

/** 点燃：一声被压住的"噗"，带一点上扬。 */
export function sfxIgnite() {
  noiseBurst({ duration: 0.5, from: 1400, to: 160, gain: 0.2 })
  const c = ensure()
  if (!c || muted) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.45)
  g.gain.setValueAtTime(0.12, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5)
  osc.connect(g).connect(master)
  osc.start()
  osc.stop(c.currentTime + 0.5)
}

/** 翻页/切换：一声极短的"沙"。 */
export function sfxPage() {
  noiseBurst({ duration: 0.12, from: 2600, to: 900, gain: 0.06, type: 'highpass' })
}

/** 点击：金属质的轻响。 */
export function sfxTap() {
  const c = ensure()
  if (!c || muted) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'triangle'
  osc.frequency.value = 880
  g.gain.setValueAtTime(0.05, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12)
  osc.connect(g).connect(master)
  osc.start()
  osc.stop(c.currentTime + 0.14)
}

export function startAudio() {
  if (muted) return
  ensure()
  startAmbient()
}

export function setMuted(next) {
  muted = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
  if (master) {
    master.gain.linearRampToValueAtTime(next ? 0 : 1, (ctx?.currentTime ?? 0) + 0.4)
  } else if (!next) {
    startAudio()
  }
}

export function isMuted() {
  return muted
}


/* ---------------- 背景音乐（独立开关，不跟随音效） ---------------- */
const BGM_KEY = 'march:bgm'
const BGM_SRC = `${import.meta.env.BASE_URL}audio/bgm.mp3`
const BGM_LEVEL = 0.34

let bgmEl = null
let bgmOn = true
try {
  bgmOn = localStorage.getItem(BGM_KEY) !== '0'
} catch {
  bgmOn = true
}

function ensureBgm() {
  if (bgmEl) return bgmEl
  bgmEl = new Audio(BGM_SRC)
  bgmEl.loop = true
  bgmEl.preload = 'auto'
  bgmEl.volume = 0
  return bgmEl
}

function fadeBgm(to, ms = 700, done) {
  const el = bgmEl
  if (!el) return
  if (fadeBgm.timer) window.clearInterval(fadeBgm.timer)
  const from = el.volume
  const t0 = performance.now()
  fadeBgm.timer = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms)
    el.volume = Math.min(1, Math.max(0, from + (to - from) * k))
    if (k >= 1) {
      window.clearInterval(fadeBgm.timer)
      fadeBgm.timer = null
      done?.()
    }
  }, 40)
}

/** 首次用户手势里调用：开始播放并淡入。 */
export function startBgm() {
  if (!bgmOn) return
  const el = ensureBgm()
  if (el.paused) el.play().catch(() => {})
  fadeBgm(BGM_LEVEL, 1200)
}

/** 开关背景音乐：关 = 暂停（保留进度），开 = 从原位置继续。 */
export function setBgmOn(next) {
  bgmOn = Boolean(next)
  try {
    localStorage.setItem(BGM_KEY, bgmOn ? '1' : '0')
  } catch {
    /* 忽略 */
  }
  if (!bgmOn) {
    fadeBgm(0, 500, () => bgmEl?.pause())
    return
  }
  const el = ensureBgm()
  if (el.paused) el.play().catch(() => {})
  fadeBgm(BGM_LEVEL, 700)
}

export function isBgmOn() {
  return bgmOn
}

// 仅开发环境：给无头验证用
if (import.meta.env.DEV) {
  window.__bgm = () => ({ on: bgmOn, paused: bgmEl?.paused ?? null, volume: bgmEl?.volume ?? null, t: bgmEl?.currentTime ?? null })
}

/** 事件卡阅读时把音乐让路，读完恢复。 */
export function duckBgm(on) {
  if (!bgmEl || !bgmOn) return
  fadeBgm(on ? 0.12 : BGM_LEVEL, 500)
}
