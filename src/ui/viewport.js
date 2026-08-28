// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 视口高度修正：国产 WebView（含 OPPO）在「横屏→竖屏」「键盘收起」后，
 * 100dvh / 100% 高度常常不刷新——整页卡在横屏尺寸，底部按钮被裁或留大白边。
 * 对策：把 window.innerHeight 显式写成 --app-h，并在视口可能变化的每个时机
 * （resize / orientationchange / visualViewport）重测；旋转后补三次延迟重测
 * （等旋转动画与布局稳定）。CSS 用 var(--app-h, 100dvh) 消费。
 */

/** 启动视口监听（main.jsx 渲染前调用一次）。 */
export function watchViewport() {
  const set = () => {
    const h = Math.max(320, window.innerHeight || document.documentElement.clientHeight || 0)
    document.documentElement.style.setProperty('--app-h', h + 'px')
  }
  set()
  window.addEventListener('resize', set)
  window.addEventListener('orientationchange', () => {
    set()
    setTimeout(set, 120)
    setTimeout(set, 400)
    setTimeout(set, 900)
  })
  if (window.visualViewport !== undefined && window.visualViewport !== null) {
    window.visualViewport.addEventListener('resize', set)
  }
}
