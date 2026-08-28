// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 液态玻璃实时光效引擎（v3）——两个通道都是每帧动态计算的：
 *
 * ① 折射：backdrop-filter: url(#hst-liquid)。运行时用圆角矩形 SDF 生成法线贴图
 *   （canvas → dataURL → feImage），feDisplacementMap 以它扭曲 SourceGraphic
 *   （backdrop-filter 语境下即玻璃身后像素）。身后内容滚动/变化时合成器重算，
 *   边缘颜色真实弯折——不是画死的渐变。
 *
 * ② 高光：一个全局「光源点」跟随手指；无操作时做 Lissajous 慢速巡游；
 *   手机倾斜（deviceorientation）会推动光源。rAF 把光源坐标换算成每个玻璃
 *   元素的局部坐标写入 --gx/--gy，CSS ::after 的 radial-gradient 即时渲染镜面高光。
 *
 * 环境不支持 backdrop-filter url() 时整个引擎静默退出，v2 的 blur 玻璃原样保留。
 */

const TARGETS = ['.appTabs', '.composer', '.chatTop', '.hero', '.chatSide', '.drawer', '.modal', '.demoModal']

/* 圆角矩形 SDF → 法线贴图：R/G = 法线 xy（0.5 为零），边缘 1 深度渐变到 0 */
function normalMapURL(size, radiusNorm, band) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const g = c.getContext('2d')
  const img = g.createImageData(size, size)
  const d = img.data
  const r = radiusNorm
  const sdf = (u, v) => {
    const qx = Math.abs(u) - (0.5 - r)
    const qy = Math.abs(v) - (0.5 - r)
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  }
  const e = 1 / size
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size - 0.5
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5
      const gx = (sdf(u + e, v) - sdf(u - e, v)) / (2 * e)
      const gy = (sdf(u, v + e) - sdf(u, v - e)) / (2 * e)
      const dist = -sdf(u, v)
      let t = Math.max(0, Math.min(1, dist / band))
      t = t * t * (3 - 2 * t)
      const k = 1 - t
      const nx = Math.max(-1, Math.min(1, gx * k))
      const ny = Math.max(-1, Math.min(1, gy * k))
      const i = (y * size + x) * 4
      d[i] = (nx * 0.5 + 0.5) * 255
      d[i + 1] = (ny * 0.5 + 0.5) * 255
      d[i + 2] = 255
      d[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

function installDefs(url) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden'
  svg.innerHTML =
    '<defs><filter id="hst-liquid" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/>' +
    '<feImage href="' + url + '" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="n"/>' +
    '<feDisplacementMap in="b" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter></defs>'
  document.body.appendChild(svg)
}

export function initGlass() {
  const supported =
    (typeof CSS !== 'undefined' && CSS.supports && (CSS.supports('backdrop-filter', 'url(#a)') || CSS.supports('-webkit-backdrop-filter', 'url(#a)')))
  if (!supported) return
  try { installDefs(normalMapURL(256, 0.16, 0.16)) } catch (e) { return }
  document.documentElement.classList.add('lg-on')

  /* ── 全局光源：手指/触摸驱动，闲置巡游，陀螺仪微调 ── */
  let lx = window.innerWidth * 0.5, ly = -60
  let tx = lx, ty = ly, lastTouch = -1e9
  let tiltX = 0, tiltY = 0
  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; lastTouch = performance.now() }, { passive: true })
  window.addEventListener('pointerdown', (e) => { tx = e.clientX; ty = e.clientY; lastTouch = performance.now() }, { passive: true })
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma === null && e.beta === null) return
    tiltX = Math.max(-1, Math.min(1, (e.gamma || 0) / 35))
    tiltY = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 60))
  }, { passive: true })

  const prev = new WeakMap()
  function tick(now) {
    requestAnimationFrame(tick)
    if (document.hidden) return
    /* 闲置 2.5s 后光源沿 Lissajous 轨迹巡游；倾斜量叠加在两种模式上 */
    if (now - lastTouch > 2500) {
      const t = now / 1000
      tx = window.innerWidth * (0.5 + 0.42 * Math.sin(t * 0.23))
      ty = window.innerHeight * (0.45 + 0.4 * Math.sin(t * 0.31 + 1.3))
    }
    lx += (tx + tiltX * 120 - lx) * 0.12
    ly += (ty + tiltY * 120 - ly) * 0.12
    for (const sel of TARGETS) {
      const els = document.querySelectorAll(sel)
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const gx = Math.round(lx - r.left), gy = Math.round(ly - r.top)
        const p = prev.get(el)
        if (p && p[0] === gx && p[1] === gy) continue
        prev.set(el, [gx, gy])
        el.style.setProperty('--gx', gx + 'px')
        el.style.setProperty('--gy', gy + 'px')
      }
    }
  }
  requestAnimationFrame(tick)
}