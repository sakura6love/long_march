/**
 * 极简键值计数（Vercel KV / Upstash 的 REST 协议）。
 *
 * 没配环境变量时退回进程内 Map —— 只用于本地开发，
 * 线上必须配 KV_REST_API_URL + KV_REST_API_TOKEN 才能在实例重启后保留。
 */
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

export const kvReady = Boolean(URL && TOKEN)

const memory = new Map()

async function command(parts) {
  if (!kvReady) return null
  try {
    const response = await fetch(`${URL}/${parts.map(encodeURIComponent).join('/')}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const data = await response.json()
    return data?.result ?? null
  } catch {
    return null
  }
}

export async function hit(key, by = 1) {
  if (kvReady) return command(['incrby', key, String(by)])
  const next = (memory.get(key) || 0) + by
  memory.set(key, next)
  return next
}

export async function read(key) {
  if (kvReady) return command(['get', key])
  return memory.get(key) ?? null
}

export async function raiseTo(key, value) {
  const current = Number(await read(key)) || 0
  if (value <= current) return current
  if (kvReady) {
    await command(['set', key, String(value)])
    return value
  }
  memory.set(key, value)
  return value
}
