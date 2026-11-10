/**
 * 四章：把 12 个站点分成四段，每段末尾停顿一次。
 * 只放数据，界面在 ChapterCard.vue 里画。
 */
export const CHAPTERS = [
  {
    id: 'chufa',
    index: 1,
    name: '出发',
    range: [0, 2],
    date: '1934 · 10 — 12',
    line: '八万六千人渡过于都河，湘江一战只剩三万。',
  },
  {
    id: 'zhuanzhe',
    index: 2,
    name: '转折',
    range: [3, 4],
    date: '1935 · 01 — 03',
    line: '遵义会议改了指挥，四渡赤水把追兵绕进山里。',
  },
  {
    id: 'tianxian',
    index: 3,
    name: '天险',
    range: [5, 7],
    date: '1935 · 05 — 08',
    line: '跨越铁索、雪山与草地，在艰险中相互扶持、继续前行。',
  },
  {
    id: 'beishang',
    index: 4,
    name: '北上',
    range: [8, 11],
    date: '1935 · 09 — 1936 · 10',
    line: '过了腊子口就是陕北，会宁三军会师，长征结束。',
  },
]

/** 某一段（两站之间）属于第几章：返回 1..4 */
export function chapterOfSegment(segIndex) {
  for (const c of CHAPTERS) {
    if (segIndex >= c.range[0] && segIndex < c.range[1]) return c.index
  }
  return CHAPTERS[CHAPTERS.length - 1].index
}

/** 某章最后一站的序号（章末停顿处） */
export function chapterEndStation(chapterIndex) {
  const c = CHAPTERS.find((x) => x.index === chapterIndex)
  return c ? c.range[1] : 0
}
