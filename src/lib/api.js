/**
 * 数据层收口：组件只调这里的函数，不直接碰 localStorage / fetch。
 * 以后要接真后端（Supabase 之类），只改这个文件，页面一行都不用动。
 */

const LIT_KEY = 'march:lit'

/** 读"已点亮"的站点 id 集合；坏数据一律当空集，不让它把页面弄崩。 */
export function readLitIds() {
  try {
    const raw = window.localStorage.getItem(LIT_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * 点亮一个站点，返回最新的 id 列表（去重、保序）。
 * 现在是"存在这台设备上"，没有网络也能用；接后端时这里换成一次 POST 即可。
 */
export function lightUp(id) {
  const ids = readLitIds()
  if (!ids.includes(id)) ids.push(id)
  try {
    window.localStorage.setItem(LIT_KEY, JSON.stringify(ids))
  } catch {
    // 隐私模式写不进去就算了，不打断体验
  }
  return ids
}

/** 重走长征路：清空已点亮的站点。 */
export function clearProgress() {
  try {
    window.localStorage.removeItem(LIT_KEY)
  } catch {
    // 隐私模式下删不掉也无所谓
  }
}
