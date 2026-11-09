/**
 * GET  /api/stats  → { available, asks, lights }
 * POST /api/stats  → { lights: 当前最多点亮站数 }（只升不降）
 *
 * 页脚那句「已有 N 人提问 · 最多点亮 M 站」就来自这里。
 * 没有配置 KV 时 available=false，前端直接不显示，不报错。
 */
import { kvReady, hit, read, raiseTo } from './_kv.js'

function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 4000) raw = raw.slice(0, 4000)
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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const [asks, lights] = await Promise.all([read('asks'), read('lights')])
    send(res, 200, {
      available: kvReady,
      asks: Number(asks) || 0,
      lights: Number(lights) || 0,
    })
    return
  }

  if (req.method === 'POST') {
    const body = await readBody(req)
    const lights = Math.max(0, Math.min(12, Number(body.lights) || 0))
    if (lights > 0) await raiseTo('lights', lights)
    await hit('visits').catch(() => {})
    send(res, 200, { ok: true, lights })
    return
  }

  send(res, 405, { error: 'method' })
}
