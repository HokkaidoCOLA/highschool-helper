// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 应用状态：store 单例 + 全局刷新总线。
 * 任何写操作（评分、录题、改设置…）后 notify()，所有 useResource 订阅者重取数据，
 * 对应插件版里 apiPost 之后的 bus.emit()。
 */
import { Store } from './core/store.js'

export const store = new Store()

const listeners = new Set()

/** 广播「数据变了」。 */
export function notify() {
  for (const fn of [...listeners]) {
    try { fn() } catch (err) { console.warn('[hst-app] 刷新订阅者失败：' + String(err)) }
  }
}

/**
 * 订阅数据变化。
 * @param {() => void} fn 回调。
 * @returns {() => void} 退订。
 */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
