import longMarchNodes from '../data.js'
import { STORY_EVENTS } from './story.js'

/**
 * 本地档案检索：把 12 站 + 8 事件切成「条目」，用关键词打分取 top-3。
 *
 * 定位不是“搜索框”，而是三层降级里的兜底层：
 * 后端没配 key / 网慢 / 断流时，这里必须立刻给出一个可信、有出处的答案，
 * 而不是一句“服务不可用”。
 */

const STATIONS = longMarchNodes.map((node) => ({
  kind: 'station',
  id: node.id,
  name: node.name,
  date: node.date,
  label: `第 ${String(longMarchNodes.indexOf(node) + 1).padStart(2, '0')} 站 ${node.name}`,
  text: [
    node.quote,
    node.lead,
    ...(node.sections || []).map((s) => `${s.h}：${s.p}`),
    node.description,
  ]
    .filter(Boolean)
    .join('\n'),
  facts: node.facts || [],
}))

const EVENTS = STORY_EVENTS.map((event) => ({
  kind: 'event',
  id: event.id,
  name: event.place,
  date: event.date,
  label: `史事 ${event.title}`,
  text: [event.title, event.text, ...(event.points || [])].filter(Boolean).join('\n'),
  facts: [],
}))

const ENTRIES = [...STATIONS, ...EVENTS]

/** 中文没有空格，用双字切分做粗糙倒排，够 20 条语料用。 */
function grams(text) {
  const clean = String(text || '').replace(/[\s，。、；：·—「」《》…！？,.!?;:'"()-]/g, '')
  const set = new Set()
  for (let i = 0; i < clean.length - 1; i += 1) set.add(clean.slice(i, i + 2))
  return set
}

for (const entry of ENTRIES) entry.g = grams(`${entry.name} ${entry.label} ${entry.text}`)

const STOP = new Set(['长征', '什么', '怎么', '为何', '多少', '哪些', '一共', '走了', '结束', '标志'])

function score(query, entry) {
  const q = grams(query)
  let hit = 0
  for (const token of q) {
    if (STOP.has(token)) continue
    if (entry.g.has(token)) hit += 1
  }
  // 直接命中名称权重更高
  if (entry.name && query.includes(entry.name)) hit += 6
  return hit
}

export function searchArchive(query, limit = 3) {
  const ranked = ENTRIES.map((entry) => ({ entry, s: score(query, entry) }))
    .filter((item) => item.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
  return ranked.map((item) => item.entry)
}

/** 给模型看的上下文，控制在 1200 字内，避免吞 token。 */
export function contextFor(query) {
  const hits = searchArchive(query, 3)
  if (!hits.length) return ''
  const chunks = hits.map((entry) => {
    const body = entry.text.replace(/\n+/g, ' ').slice(0, 320)
    return `《${entry.label}》${entry.date ? `（${entry.date}）` : ''}\n${body}`
  })
  return chunks.join('\n\n').slice(0, 1200)
}

/**
 * 离线答案：命中就用原文重排；没命中就给“导览式”回答 + 三个可点的相关条目，
 * 绝不返回“我不知道”四个字了事。
 */
export function localAnswer(query) {
  const hits = searchArchive(query, 2)
  if (!hits.length) {
    return {
      text:
        '馆藏里没有直接对应的条目。你可以换一种问法，或从下面三处走过去：' +
        '瑞金（出发）、遵义（转折）、会宁（会师）。',
      sources: [
        { label: STATIONS[0].label, name: STATIONS[0].name },
        { label: STATIONS[3].label, name: STATIONS[3].name },
        { label: STATIONS[11].label, name: STATIONS[11].name },
      ],
      weak: true,
    }
  }

  const primary = hits[0]
  // 优先用「导语 + 第一段」；答案里不出现小标题，也不追加 fact。
  const raw = primary.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[^：]{2,10}：/, ''))
  const sentences = raw
    .join('。')
    .split(/[。]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
  let body = ''
  for (const sentence of sentences) {
    if (body.length + sentence.length > 150) break
    body += sentence + '。'
  }
  if (!body) body = raw.join('').slice(0, 120)

  return {
    text: body,
    sources: hits.map((entry) => ({ label: entry.label, name: entry.name })),
    weak: false,
  }
}
