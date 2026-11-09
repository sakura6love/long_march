/**
 * 本地开发服务器：把 dist/ 当静态站点，并把 api/ 下的函数挂到 /api/*。
 * 用法：node server.mjs   （先 npm run build）
 *
 * 不引 express：只用 node 内置 http，装完依赖即可跑，
 * 也让评委那边“npm i 之后少一个依赖出错的可能”。
 */
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import chat from './api/chat.js'
import stats from './api/stats.js'

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
    // SPA 回退
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

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (pathname === '/api/chat') return chat(req, res)
  if (pathname === '/api/stats') return stats(req, res)
  if (pathname.startsWith('/api/')) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'not-found' }))
    return
  }
  return serveStatic(req, res)
})

server.listen(PORT, () => {
  const key = process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置（问答将走本地档案）'
  console.log(`长征展馆  http://localhost:${PORT}`)
  console.log(`模型密钥  ${key}`)
})
