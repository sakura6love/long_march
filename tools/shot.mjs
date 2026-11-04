/**
 * tools/shot.mjs —— 用 CDP 驱动 headless Edge
 *
 * 用途：
 *   node tools/shot.mjs --out shots/x.png              截图
 *   node tools/shot.mjs --hover zunyi                  先把鼠标移到某个节点上再截图
 *   node tools/shot.mjs --click zunyi                  点击某个节点后再截图
 *
 * 每次运行都会把「所有标签锚点在屏幕上的实际位置」以 JSON 打印到 stdout，
 * P2 校准"选中点是否落在 30% 屏高"时直接读这份数据即可。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

const url = arg('url', 'http://127.0.0.1:5173/')
const out = resolve(arg('out', 'shots/shot.png'))
const width = Number(arg('w', 1920))
const height = Number(arg('h', 1080))
const hoverId = arg('hover', '')
const clickId = arg('click', '')
const waitMs = Number(arg('wait', 7000))
const port = Number(arg('port', 9333))

const profile = mkdtempSync(join(tmpdir(), 'edge-cdp-'))
const browser = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

async function waitForDevtools() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return
    } catch {
      /* 端口还没开，继续等 */
    }
    await sleep(200)
  }
  throw new Error('DevTools 端口没有起来')
}

let messageId = 0
const pending = new Map()

function send(ws, method, params = {}) {
  const id = (messageId += 1)
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolvePromise, rejectPromise) => {
    pending.set(id, { resolve: resolvePromise, reject: rejectPromise })
  })
}

try {
  await waitForDevtools()

  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
  ).json()

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })

  const logs = []

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)

    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      logs.push(`EXCEPTION: ${d.exception?.description || d.text}`)
      return
    }

    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(
        `CONSOLE.${msg.params.type}: ${msg.params.args
          .map((a) => a.value ?? a.description ?? a.type)
          .join(' ')}`,
      )
      return
    }

    if (!msg.id || !pending.has(msg.id)) return
    const task = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) task.reject(new Error(msg.error.message))
    else task.resolve(msg.result)
  }

  await send(ws, 'Page.enable')
  await send(ws, 'Runtime.enable')
  await send(ws, 'Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  })
  await send(ws, 'Page.navigate', { url })
  await sleep(waitMs)

  // 标签是 globe.gl 渲染时才挂到 DOM 的，CDN 贴图慢的时候 7s 还不够。
  // 统一在这里等它出现，避免量到空数组。
  async function waitForLabels(min = 12, timeout = 15000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeout) {
      const { result } = await send(ws, 'Runtime.evaluate', {
        returnByValue: true,
        expression: "document.querySelectorAll('.march-label-anchor').length",
      })
      if ((result.value || 0) >= min) return result.value
      await sleep(250)
    }
    return 0
  }

  // --nowait：跳过等标签挂载的等待，用于抓开场动画的指定帧。
  if (!process.argv.includes('--nowait')) {
  await waitForLabels()
  // 标签刚挂上 DOM 时还停在上一帧的投影位置，等两帧再量。
  await sleep(1200)
  }

  // 可选：截图前在页面里执行一段脚本（标定机位、关掉自转等）。
  const evalExpr = arg('eval', '')
  if (evalExpr) {
    const { result, exceptionDetails } = await send(ws, 'Runtime.evaluate', {
      returnByValue: true,
      awaitPromise: true,
      expression: evalExpr,
    })
    if (exceptionDetails) {
      logs.push(`EVAL ERROR: ${exceptionDetails.exception?.description || exceptionDetails.text}`)
    } else if (result?.value !== undefined) {
      logs.push(`EVAL: ${JSON.stringify(result.value)}`)
    }
    await sleep(2600)
  }

  /** 读取所有标签锚点在屏幕上的位置与状态。 */
  const measure = async () => {
    const { result } = await send(ws, 'Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const nodes = [...document.querySelectorAll('.march-label-anchor')].map((el) => {
          const box = el.getBoundingClientRect()
          return {
            id: el.dataset.nodeId,
            x: Math.round(box.x * 10) / 10,
            y: Math.round(box.y * 10) / 10,
            far: el.classList.contains('is-far'),
            flipped: el.classList.contains('is-flipped'),
            active: el.classList.contains('is-active'),
          }
        })
        return JSON.stringify({ width: innerWidth, height: innerHeight, nodes })
      })()`,
    })
    return JSON.parse(result.value)
  }

  const before = await measure()

  const pick = before.nodes.find((n) => n.id === (clickId || hoverId))
  if (pick) {
    await send(ws, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: pick.x,
      y: pick.y,
      button: 'none',
      buttons: 0,
    })
    await sleep(500)

    if (clickId) {
      await send(ws, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: pick.x,
        y: pick.y,
        button: 'left',
        buttons: 1,
        clickCount: 1,
      })
      await send(ws, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: pick.x,
        y: pick.y,
        button: 'left',
        buttons: 0,
        clickCount: 1,
      })
      await sleep(2200)
    }
  }

  const after = await measure()
  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' })

  const { result: probe } = await send(ws, 'Runtime.evaluate', {
    returnByValue: true,
    expression: `JSON.stringify({
      canvas: document.querySelectorAll('canvas').length,
      canvasSize: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null })(),
      labels: document.querySelectorAll('.march-label-anchor').length,
      app: document.querySelector('#app')?.children.length || 0,
    })`,
  })

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))

  console.log(
    JSON.stringify(
      {
        out,
        viewport: { width, height },
        hover: hoverId || null,
        click: clickId || null,
        probe: JSON.parse(probe.value),
        logs,
        before,
        after,
      },
      null,
      2,
    ),
  )

  ws.close()
} finally {
  browser.kill()
}
