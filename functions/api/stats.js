/**
 * GET  /api/stats → { available, asks, lights }
 * POST /api/stats → { lights }  (去重后只升不降)
 *
 * KV binding 名：STATS（Pages → Settings → Bindings → KV namespace）。
 * 未绑定则 available=false，前端不显示计数，不报错。
 */

const memory = new Map()

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

async function readKey(env, key) {
  if (env.STATS) return Number(await env.STATS.get(key)) || 0
  return Number(memory.get(key)) || 0
}

async function raiseTo(env, key, value) {
  const current = await readKey(env, key)
  if (value <= current) return current
  if (env.STATS) {
    await env.STATS.put(key, String(value))
    return value
  }
  memory.set(key, value)
  return value
}

async function hash(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function onRequestGet({ env }) {
  const [asks, lights] = await Promise.all([readKey(env, 'asks'), readKey(env, 'lights')])
  return json(200, { available: Boolean(env.STATS), asks, lights })
}

export async function onRequestPost({ request, env }) {
  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const lights = Math.max(0, Math.min(12, Number(body.lights) || 0))
  if (lights > 0) {
    const ip =
      request.headers.get('cf-connecting-ip') ||
      (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
      'unknown'
    const day = new Date().toISOString().slice(0, 10)
    const visitor = await hash(`${ip}|${day}`)
    if (env.STATS) {
      const seen = await env.STATS.get(`lit:${visitor}`)
      if (!seen) {
        await env.STATS.put(`lit:${visitor}`, '1', { expirationTtl: 86_400 })
        await raiseTo(env, 'lights', lights)
      }
    } else {
      await raiseTo(env, 'lights', lights)
    }
  }
  const current = await readKey(env, 'lights')
  return json(200, { ok: true, lights: current })
}
