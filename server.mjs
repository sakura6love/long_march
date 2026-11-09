/**
 * 本地演示服务器：把 dist/ 当静态站点，并把 functions/api/*.js 挂到 /api/*。
 * 用法：npm run build && node server.mjs   （默认 8080）
 *
 * 只依赖 node 内置模块，不引 express；API 复用 Cloudflare Pages Functions 的代码，
 * 保证「本地演示」与「线上部署」走同一份逻辑。
 */
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { Readable } from 'node:stream'
import * as chatApi from './functions/api/chat.js'
import * as statsApi from './functions/api/stats.js'

const ROOT = resolve(process.cwd(), 'dist')
const PORT = Number(process.env.PORT) || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
  let file = join(ROOT, safe === '/' ? 'index.html' : safe)
  if (!file.startsWith(ROOT)) {
    res.statusCode = 403
    res.end('forbidden')
    return
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) {
    file = join(ROOT, 'index.html')
    if (!existsSync(file)) {
      res.statusCode = 404
      res.end('dist/ 不存在，请先运行 npm run build')
      return
    }
  }
  res.statusCode = 200
  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream')
  createReadStream(file).pipe(res)
}

function env() {
  return {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    STATS: undefined, // 本地不接 KV，functions 内部会退回内存
  }
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks)
}

async function handleApi(api, req, res) {
  const handler =
    req.method === 'GET' ? api.onRequestGet || api.onRequest : api.onRequestPost || api.onRequest
  if (!handler) {
    res.statusCode = 405
    res.end(JSON.stringify({ error: 'method-not-allowed' }))
    return
  }
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers,
    body,
  })
  const response = await handler({
    request,
    env: env(),
    waitUntil: (p) => Promise.resolve(p).catch(() => {}),
  })
  res.statusCode = response.status
  response.headers.forEach((v, k) => res.setHeader(k, v))
  if (response.body) Readable.fromWeb(response.body).pipe(res)
  else res.end(await response.text())
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (pathname === '/api/chat') return await handleApi(chatApi, req, res)
    if (pathname === '/api/stats') return await handleApi(statsApi, req, res)
    if (pathname.startsWith('/api/')) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'not-found' }))
      return
    }
    return serveStatic(req, res)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'server-error', message: String(err && err.message) }))
  }
})

server.listen(PORT, () => {
  const key = process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置（问答将走本地档案）'
  console.log(`长征展馆  http://localhost:${PORT}`)
  console.log(`模型密钥  ${key}`)
})
