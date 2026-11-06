/**
 * 长征事件脚本。
 *
 * at 的含义：火线烧到"第几位站点"时触发（12 个站点见 data.js 的顺序）。
 *   - 整数 = 到达该站时触发（如 遵义 = 3）
 *   - 小数 = 在两站之间的路上触发（如 4.6 = 赤水→泸定桥 这段走了一大半）
 * 这里刻意只做 8 个事件——每站都插一段，节奏会散。
 *
 * image 先用占位图（public/events/*.webp），换成真图时保持同名即可，不用改代码。
 */
export const STORY_EVENTS = [
  {
    id: 'xiangjiang',
    at: 2,
    date: '1934 · 11 · 27 — 12 · 01',
    title: '血战湘江',
    text: '八万六千人渡江，五天五夜。江水被血染红，浮桥一次次被炸断又一次次架起。过了江，队伍只剩三万——这是长征路上最惨烈的一战，也是"左"倾路线走到尽头的证明。',
    credit: '湘江渡口 · 占位图',
    image: '/events/xiangjiang.webp',
  },
  {
    id: 'zunyi',
    at: 3,
    date: '1935 · 01 · 15 — 01 · 17',
    title: '遵义会议',
    text: '一间长方形的屋子，一张长桌，三天的争论。会议纠正了军事指挥的错误，重新确立了实事求是的路线。此后红军四渡赤水、巧渡金沙江，都是从这间屋子里开始的。',
    credit: '遵义会议会址 · 占位图',
    image: '/events/zunyi.webp',
  },
  {
    id: 'chishui',
    at: 4,
    date: '1935 · 01 — 03',
    title: '四渡赤水',
    text: '一渡土城，二渡太平渡，三渡茅台，四渡二郎滩。三个多月里，三万人在地图上画了一个来回折叠的圈，把四十万追兵绕晕在川黔滇的群山里。',
    credit: '赤水河 · 占位图',
    image: '/events/chishui.webp',
    diagram: true,
  },
  {
    id: 'jinsha',
    at: 4.6,
    date: '1935 · 05 · 01 — 05 · 09',
    title: '巧渡金沙江',
    text: '皎平渡只有七条木船。九天九夜，三万人从这条细窄的渡口过江。等追兵赶到，江面上只剩空船和系船的石头。',
    credit: '皎平渡 · 占位图',
    image: '/events/jinsha.webp',
  },
  {
    id: 'luding',
    at: 5,
    date: '1935 · 05 · 29',
    title: '飞夺泸定桥',
    text: '十三根铁索横在江上，桥板已被抽去。二十二名突击队员攀着铁链匍匐向前，对岸机枪扫射，身下是大渡河的急流。两小时，桥夺回来了。',
    credit: '泸定桥铁索 · 占位图',
    image: '/events/luding.webp',
  },
  {
    id: 'jiajin',
    at: 6,
    date: '1935 · 06 · 12',
    title: '翻越夹金山',
    text: '海拔四千多米，空气稀薄，雪深过膝。队伍在雪线上走了一整天，许多人坐下休息就再没站起来。翻过山，红一、红四方面军在懋功会合。',
    credit: '夹金山 · 占位图',
    image: '/events/jiajin.webp',
  },
  {
    id: 'caodi',
    at: 7,
    date: '1935 · 08',
    title: '过草地',
    text: '松潘草地，方圆数百里的沼泽。一脚踩空就陷进去，没有树，没有干燥的地方，夜里只能背靠背坐着。七天七夜走出草地，队伍又少了一批人。',
    credit: '松潘草地 · 占位图',
    image: '/events/caodi.webp',
  },
  {
    id: 'huining',
    at: 11,
    date: '1936 · 10',
    title: '会宁会师',
    text: '红一、红二、红四方面军在会宁会合。两万五千里，从瑞金到会宁，纵横十一个省。这条路上倒下的人，比走到终点的人多得多。',
    credit: '会宁会师楼 · 占位图',
    image: '/events/huining.webp',
  },
]

/** 找出"从 from 到 to 之间"应该触发的事件（含到达 to 时的）。 */
export function eventsBetween(events, from, to) {
  return events.filter((e) => e.at > from && e.at <= to)
}
