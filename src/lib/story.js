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
    place: '湘江渡口 · 兴安',
    points: ["从长征出发时 8.6 万余人，到渡过湘江后 3 万余人", "突破第四道封锁线，损失过半", "此战后通道转兵，方向开始改变"],
    at: 2,
    date: '1934 · 11 · 27 — 12 · 01',
    title: '血战湘江',
    text: '1934 年 11 月底，中央红军在湘江两岸突破第四道封锁线。部队在长征出发后沿途作战与减员，至渡过湘江时由出发时的八万六千余人减至三万余人。湘江战役的重大牺牲，促使红军反思此前的军事指挥。',
    credit: '湘江渡口 · AI 生成示意图',
    image: `${import.meta.env.BASE_URL}events/xiangjiang.webp`,
  },
  {
    id: 'zunyi',
    place: '遵义 · 老城',
    points: ["1935 年 1 月 15—17 日，政治局扩大会议", "确立毛泽东在党中央和红军的领导地位", "四渡赤水，即从这次会议之后开始"],
    at: 3,
    date: '1935 · 01 · 15 — 01 · 17',
    title: '遵义会议',
    text: '一间长方形的屋子，一张长桌，三天的争论。会议纠正了军事指挥的错误，重新确立了实事求是的路线。此后红军四渡赤水、巧渡金沙江，都是从这间屋子里开始的。',
    credit: '遵义会议会址 · AI 生成示意图',
    image: `${import.meta.env.BASE_URL}events/zunyi.webp`,
  },
  {
    id: 'chishui',
    place: '赤水河 · 土城',
    points: ["三个月内四次渡过赤水河", "3 万对 40 万，靠机动摆脱包围", "土城、太平渡、茅台、二郎滩"],
    at: 4,
    date: '1935 · 01 — 03',
    title: '四渡赤水',
    text: '一渡土城，二渡太平渡，三渡茅台，四渡二郎滩。三个多月里，三万人在地图上画了一个来回折叠的圈，把四十万追兵绕晕在川黔滇的群山里。',
    credit: '赤水河 · AI 生成示意图',
    image: `${import.meta.env.BASE_URL}events/chishui.webp`,
    diagram: true,
  },
  {
    id: 'jinsha',
    place: '金沙江 · 皎平渡',
    points: ["皎平渡，7 条木船", "9 天 9 夜，全军渡完", "从此跳出数十万追兵的包围圈"],
    at: 4.6,
    date: '1935 · 05 · 01 — 05 · 09',
    title: '巧渡金沙江',
    text: '皎平渡只有七条木船。九天九夜，三万人从这条细窄的渡口过江。等追兵赶到，江面上只剩空船和系船的石头。',
    credit: '皎平渡 · AI 生成示意图',
    image: `${import.meta.env.BASE_URL}events/jinsha.webp`,
  },
  {
    id: 'luding',
    sources: [{ label: '西藏自治区文化和旅游厅：飞夺泸定桥', url: 'https://wlt.xizang.gov.cn/xwzx_69/xydt/202102/t20210224_193792.html' }],
    place: '大渡河 · 泸定桥',
    points: ["1935 年 5 月 29 日，一昼夜 240 里", "22 名突击队员攀铁索过江", "泸定桥一夺，北上通道打开"],
    at: 5,
    date: '1935 · 05 · 29',
    title: '飞夺泸定桥',
    text: '十三根铁索横在江上，桥板已被抽去。二十二名突击队员攀着铁链匍匐向前，对岸机枪扫射，身下是大渡河的急流。两小时，桥夺回来了。',
    credit: '泸定桥铁索 · AI 生成示意图',
    image: `${import.meta.env.BASE_URL}events/luding.webp`,
  },
  {
    id: 'jiajin',
    place: '夹金山 · 宝兴',
    points: ["海拔 4000 米以上", "中央红军翻越的第一座大雪山", "单衣草鞋，许多人倒在雪线上"],
    at: 6,
    date: '1935 · 06 · 12',
    title: '翻越夹金山',
    text: '海拔四千多米，空气稀薄，雪深过膝。队伍在雪线上走了一整天，许多人坐下休息就再没站起来。翻过山，红一、红四方面军在懋功会合。',
    credit: '夹金山 · AI 生成示意图',
    image: `${import.meta.env.BASE_URL}events/jiajin.webp`,
  },
  {
    id: 'caodi',
    place: '松潘草地 · 班佑',
    points: ["松潘草地，沼泽遍布", "粮食短缺与沼泽地形带来严峻考验", "走出草地时，队伍已不足出发时的一半"],
    at: 7,
    date: '1935 · 08',
    title: '过草地',
    text: '松潘草地，方圆数百里的沼泽。一脚踩空就陷进去，没有树，没有干燥的地方，夜里只能背靠背坐着。七天七夜走出草地，队伍又少了一批人。',
    credit: '松潘草地 · AI 生成示意图',
    image: `${import.meta.env.BASE_URL}events/caodi.webp`,
  },
  {
    id: 'huining',
    sources: [{ label: '中央党史和文献研究院：长征胜利九十周年专题', url: 'https://www.dswxyjy.org.cn/GB/427277/462086/' }],
    place: '会宁 · 会师楼',
    points: ["1936 年 10 月，红一、二、四方面军会师", "中央红军长征行程约两万五千里", "会宁因此被称为长征会师圣地"],
    at: 11,
    date: '1936 · 10',
    title: '会宁会师',
    text: '1936 年 10 月，红军主力在会宁、将台堡等地胜利会师，标志着长征胜利结束。不同的行军路线在西北汇聚，长征留下的理想、团结与信念，在此成为继续前行的力量。',
    credit: '会宁会师楼 · AI 生成示意图',
    image: `${import.meta.env.BASE_URL}events/huining.webp`,
  },
]

/** 找出"从 from 到 to 之间"应该触发的事件（含到达 to 时的）。 */
export function eventsBetween(events, from, to) {
  return events.filter((e) => e.at > from && e.at <= to)
}
