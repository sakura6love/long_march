/**
 * 与后端的唯一通道：POST /api/chat，SSE 流式拿回答。
 *
 * 这一层只做「请求 / 超时 / 取消 / 解析流」，不关心 UI，也不做降级决策；
 * 降级由 AskPanel 决定（先本地检索，AI 失败就直接用本地答案）。
 */

const API_BASE = import.meta.env.VITE_API_BASE || ''
export const CHAT_URL = `${API_BASE}/api/chat`
export const STATS_URL = `${API_BASE}/api/stats`

/** 首字节超时：慢网下大模型常在 2~4s 才吐第一个字，3s 会误杀。 */
export const FIRST_BYTE_TIMEOUT = 4500
/** 整体超时：留足 150 字中文的输出时间。 */
export const TOTAL_TIMEOUT = 30000

export class ChatError extends Error {
  constructor(code, message) {
    super(message || code)
    this.name = 'ChatError'
    this.code = code
  }
}

/**
 * @param {object} options
 * @param {string} options.question
 * @param {string} [options.context] 本地检索出的史料，作为 grounding
 * @param {(delta: string) => void} [options.onDelta]
 * @param {(meta: object) => void} [options.onMeta]
 * @param {AbortSignal} [options.signal] 外部取消（如关闭面板）
 */
export async function askAI({ question, context = '', onDelta, onMeta, signal }) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal) {
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  }

  let timedOut = null
  let firstTimer = setTimeout(() => {
    timedOut = 'first-byte'
    controller.abort()
  }, FIRST_BYTE_TIMEOUT)
  const totalTimer = setTimeout(() => {
    timedOut = 'total'
    controller.abort()
  }, TOTAL_TIMEOUT)

  const clearTimers = () => {
    clearTimeout(firstTimer)
    clearTimeout(totalTimer)
  }

  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: question, context }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new ChatError(`http-${response.status}`, `接口返回 ${response.status}`)
    }
    if (!response.body) {
      throw new ChatError('no-stream', '当前浏览器不支持流式响应')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let text = ''
    let received = false

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
        if (parsed.delta) {
          if (!received) {
            received = true
            clearTimeout(firstTimer)
          }
          text += parsed.delta
          onDelta?.(parsed.delta)
        }
        if (parsed.meta) onMeta?.(parsed.meta)
      }
    }

    if (!text) throw new ChatError('empty', '模型没有返回内容')
    return { text }
  } catch (error) {
    if (timedOut) throw new ChatError('timeout', '连接超时')
    if (error?.name === 'AbortError') throw new ChatError('aborted', '已取消')
    if (error instanceof ChatError) throw error
    throw new ChatError('network', error?.message || '网络错误')
  } finally {
    clearTimers()
    signal?.removeEventListener?.('abort', abort)
  }
}

/** 页脚统计：失败就当没有，不打扰任何流程。 */
export async function fetchStats() {
  try {
    const response = await fetch(STATS_URL, { headers: { Accept: 'application/json' } })
    if (!response.ok) return null
    const data = await response.json()
    if (!data || data.available === false) return null
    return data
  } catch {
    return null
  }
}
