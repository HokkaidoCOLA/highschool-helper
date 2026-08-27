// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 引擎装载：按依赖顺序引入插件仓库原样复制来的四个浏览器脚本（00 → 10 → 20 → 30），
 * 再把共享演示器（Player）暴露给界面。
 *
 * 与 DSH 里不同，App 不套 iframe——引擎是自家可信代码，直接挂在 DOM 上。
 * 特意不使用引擎自带的 mount()：那是给沙箱 iframe 设计的，会在 window 上监听
 * message；顶层页面里 Player 自己 post 出去的 hst:step 会回声进那个监听，打断自动播放。
 * 这里直接 new NS.Player(root)，消息层整个绕开。
 */
import './00-core.browser.js'
import './10-scene2d.browser.js'
import './20-scene3d.browser.js'
import './30-shell.browser.js'

const NS = globalThis.__HST__

let cssInjected = false
let stage = null

// 演示器常驻的隐藏回收处：Player 实例全 App 只有一个（画布样式、键盘监听都挂在
// document 上，多实例会互相抢键盘），换页面只是把它的 DOM 挪来挪去。
const parking = document.createElement('div')
parking.style.display = 'none'
parking.setAttribute('aria-hidden', 'true')

// 键盘守卫：输入控件聚焦时，不让演示器抢 空格/方向键/R（引擎的 document 监听在
// 冒泡阶段，这里用捕获阶段按需 stopPropagation；不拦截 Esc 等其余按键）。
window.addEventListener('keydown', (ev) => {
  const t = ev.target
  const tag = t && t.tagName
  const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) === true
  if (!editing) return
  if (ev.key === ' ' || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'r' || ev.key === 'R') {
    ev.stopPropagation()
  }
}, true)

function ensureStage() {
  if (stage !== null) return stage
  if (!cssInjected) {
    const style = document.createElement('style')
    style.textContent = NS.CSS
    document.head.appendChild(style)
    cssInjected = true
  }
  if (parking.parentNode === null) document.body.appendChild(parking)
  const root = document.createElement('div')
  root.id = 'hst-root'
  parking.appendChild(root)
  const player = new NS.Player(root, { mode: 'panel', token: 'hst-app' })
  stage = { root, player }
  return stage
}

/**
 * 把共享演示器挂进容器并装载场景。
 * @param {HTMLElement} container 承载演示的容器。
 * @param {object|null} scene 规范化后的场景（null 表示只挪位置不重载）。
 * @param {object} [flags] bare/compact/lockFirst/questionsOnly/ratio。
 * @returns {object} Player 实例。
 */
export function showScene(container, scene, flags) {
  const s = ensureStage()
  const f = flags || {}
  container.appendChild(s.root)
  s.player.bare = f.bare === true
  s.player.compact = f.compact === true
  s.player.lockFirst = f.lockFirst === true
  s.player.questionsOnly = f.questionsOnly === true
  s.player.viewRatio = Number.isFinite(f.ratio) ? f.ratio : undefined
  if (scene) s.player.load(scene)
  requestAnimationFrame(() => { s.player.layout(); s.player.render() })
  return s.player
}

/** 从当前页面摘下演示器（回收到隐藏处，实例保持存活）。 */
export function hideStage() {
  if (stage !== null) parking.appendChild(stage.root)
}

/** 主题：App 直接定义 --hst-* 变量，切明暗后调用它让引擎调色板重读。 */
export function refreshPalette() {
  NS.palette(true)
  if (stage !== null) stage.player.render()
}

export { NS }
