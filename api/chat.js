/**
 * POST /api/chat
 *
 * 只做三件事：校验输入 → 带上馆藏史料调用大模型 → 把回答以 SSE 流式转给前端。
 * KEY 只在服务端，前端拿不到。
 */
import { hit } from './_kv.js'

const KEY = process.env.DEEPSEEK_API_KEY || ''
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const ENDPOINT =
  process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions'

const SYSTEM = `你是「长征万里 · 薪火千秋」数字展馆的讲解员。
规则：
1. 只依据用户附带的【馆藏资料】作答；资料里没有的年代、人数、地名，一律不编，可以直说“馆藏中没有这一条”。
2. 语气沉静、克制，像展签而不是科普短视频。
3. 150 字以内，不分点、不用标题，最多三句。
4. 不要复述问题，不要写“根据资料”这类前置话术。`

const WINDOW_MS = 60_000
const LIMIT = 8
const bucket = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const entry = bucket.get(ip) || { start: now, count: 0 }
  if (now - entry.start > WINDOW_MS) {
    entry.start = now
    entry.count = 0
  }
  entry.count += 1
  bucket.set(ip, entry)
  return entry.count > LIMIT
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 32_000) raw = raw.slice(0, 32_000)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'POST') {
    json(res, 405, { error: 'method' })
    return
  }

  // 没有配置 Key 时立刻返回，让前端瞬间切到档案模式，而不是干等超时。
  if (!KEY) {
    json(res, 503, { error: 'no-key', message: '服务端未配置模型密钥' })
    return
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  if (rateLimited(ip)) {
    json(res, 429, { error: 'rate-limited', message: '提问太快了，稍等一下' })
    return
  }

  const body = await readBody(req)
  const question = String(body.q || '').trim().slice(0, 200)
  const context = String(body.context || '').trim().slice(0, 4000)
  if (question.length < 2) {
    json(res, 400, { error: 'empty-question' })
    return
  }

  const userMessage = context
    ? `【馆藏资料】\n${context}\n\n【访客提问】\n${question}`
    : question

  let upstream
  try {
    upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        temperature: 0.35,
        max_tokens: 360,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userMessage },
        ],
      }),
    })
  } catch (error) {
    json(res, 502, { error: 'upstream-unreachable', message: String(error?.message || '') })
    return
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    json(res, 502, { error: 'upstream-error', status: upstream.status, detail: detail.slice(0, 200) })
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.write(`data: ${JSON.stringify({ meta: { model: MODEL, grounded: Boolean(context) } })}\n\n`)

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let parsed
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }
        const delta = parsed?.choices?.[0]?.delta?.content
        if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`)
      }
    }
  } catch {
    // 上游中断：已经发出的字保留，前端会按“已收到的内容”收尾。
  }

  res.write('data: [DONE]\n\n')
  res.end()
  hit('asks').catch(() => {})
}
