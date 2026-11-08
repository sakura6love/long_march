/**
 * 调试钩子：仅在 dev 下挂到 window，生产构建会被摇树移除。
 * 用法：dbg('__globe', globe.value) —— 生产环境什么都不做。
 */
export const dbg = import.meta.env.DEV
  ? (key, value) => {
      window[key] = value
    }
  : () => {}
