/**
 * POST /api/chat  (Cloudflare Pages Functions)
 *
 * 与 api/chat.js 行为一致：校验 → 带馆藏调 DeepSeek → SSE 转 data:{"delta"}。
 * 密钥只存在于 Pages 的 Environment variables，不进产物。
 */

const MODEL = 'deepseek-chat'
const ENDPOINT = 'https://api.deepseek.com/chat/completions'
const WINDOW_MS = 60_000
const LIMIT = 8

const SYSTEM = `你是「长征万里 · 薪火千秋」数字展馆的讲解员。
规则：
1. 只依据用户附带的【馆藏资料】作答；资料里没有的年代、人数、地名，一律不编，可以直说“馆藏中没有这一条”。
2. 语气沉静、克制，像展签而不是科普短视频。
3. 150 字以内，不分点、不用标题，最多三句。
4. 不要复述问题，不要写“根据资料”这类前置话术。`

const memory = new Map()

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

function ipOf(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  )
}

async function rateLimited(env, ip) {
  const minute = Math.floor(Date.now() / WINDOW_MS)
  const key = `rate:${ip}:${minute}`
  if (env.STATS) {
    const raw = await env.STATS.get(key)
    const n = (Number(raw) || 0) + 1
    await env.STATS.put(key, String(n), { expirationTtl: 90 })
    return n > LIMIT
  }
  const n = (memory.get(key) || 0) + 1
  memory.set(key, n)
  return n > LIMIT
}

async function bump(env, key) {
  if (env.STATS) {
    const n = (Number(await env.STATS.get(key)) || 0) + 1
    await env.STATS.put(key, String(n))
    return
  }
  memory.set(key, (memory.get(key) || 0) + 1)
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 })
}

export async function onRequestPost({ request, env }) {
  const key = env.DEEPSEEK_API_KEY || ''
  if (!key) return json(503, { error: 'no-key', message: '服务端未配置模型密钥' })

  if (await rateLimited(env, ipOf(request))) {
    return json(429, { error: 'rate-limited', message: '提问太快了，稍等一下' })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const question = String(body.q || '').trim().slice(0, 200)
  const context = String(body.context || '').trim().slice(0, 4000)
  if (question.length < 2) return json(400, { error: 'empty-question' })

  const userMessage = context
    ? `【馆藏资料】\n${context}\n\n【访客提问】\n${question}`
    : question

  let upstream
  try {
    upstream = await fetch(env.DEEPSEEK_BASE_URL || ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || MODEL,
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
    return json(502, { error: 'upstream-unreachable', message: String(error?.message || '') })
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    return json(502, { error: 'upstream-error', status: upstream.status, detail: detail.slice(0, 200) })
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  ;(async () => {
    try {
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({ meta: { model: env.DEEPSEEK_MODEL || MODEL, grounded: Boolean(context) } })}\n\n`
        )
      )
      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
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
          if (delta) await writer.write(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`))
        }
      }
    } catch {
      // 上游中断：已发出的字保留，前端按“已收到内容”收尾。
    }
    try {
      await writer.write(encoder.encode('data: [DONE]\n\n'))
      await writer.close()
    } catch {
      // 客户端已断开
    }
    bump(env, 'asks').catch(() => {})
  })()

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  })
}
