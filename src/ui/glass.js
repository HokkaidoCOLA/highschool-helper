// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 液态玻璃实时光效引擎 v4+——按 BiliPai(jay3-yy) 的 AGSL 配方移植到 WebView，
 * v9 起全部外观参数可由设置页滑杆实时调节（localStorage 持久化）：
 *   veil 白纱 / blur 磨砂 / sat 饱和 / blob 光斑浓度 / disp 折射强度 /
 *   band 折射带宽（重新生成法线贴图）/ sheen 高光 / rim 描边
 * CSS 侧读 --gv-* 变量；SVG 滤镜侧（stdDeviation/scale/feImage）由本模块直改。
 */

const TARGETS = ['.appTabs', '.composer', '.chatTop', '.hero', '.chatSide', '.drawer', '.modal', '.demoModal']

const TUNE_KEY = 'hst.glass.tune'
export const GLASS_DEFAULTS = { veil: 10, sat: 150, blur: 24, blob: 100, disp: 30, band: 20, sheen: 18, rim: 45 }
const CORNER = 0.16, DEPTH = 0.35

export function loadGlassTune() {
  try {
    const raw = JSON.parse(localStorage.getItem(TUNE_KEY) || '{}')
    return raw && typeof raw === 'object' ? { ...GLASS_DEFAULTS, ...raw } : { ...GLASS_DEFAULTS }
  } catch (e) { return { ...GLASS_DEFAULTS } }
}

const circleMap = (x) => 1 - Math.sqrt(Math.max(0, 1 - x * x))

function gradSDF(u, v, half, r) {
  const cx = Math.abs(u) - (half - r)
  const cy = Math.abs(v) - (half - r)
  let gx, gy
  if (cx >= 0 || cy >= 0) {
    const m = Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) || 1
    gx = Math.sign(u) * (Math.max(cx, 0) / m)
    gy = Math.sign(v) * (Math.max(cy, 0) / m)
  } else if (cx >= cy) { gx = Math.sign(u); gy = 0 }
  else { gx = 0; gy = Math.sign(v) }
  return [gx, gy]
}
function sdf(u, v, half, r) {
  const cx = Math.abs(u) - (half - r)
  const cy = Math.abs(v) - (half - r)
  return Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) + Math.min(Math.max(cx, cy), 0) - r
}

function normalMapURL(size, bandNorm) {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const g = c.getContext('2d')
  const img = g.createImageData(size, size)
  const d = img.data
  const half = 0.5
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size - 0.5
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5
      const sd = sdf(u, v, half, CORNER)
      const i = (y * size + x) * 4
      if (sd >= 0) { d[i] = 128; d[i + 1] = 128; d[i + 2] = 255; d[i + 3] = 255; continue }
      const edge = circleMap(Math.max(0, Math.min(1, 1 + sd / bandNorm)))
      const [gx, gy] = gradSDF(u, v, half, Math.min(CORNER * 1.5, half * 0.9))
      const len = Math.hypot(u, v) || 1
      let nx = gx + DEPTH * (u / len)
      let ny = gy + DEPTH * (v / len)
      const nl = Math.hypot(nx, ny) || 1
      nx = (nx / nl) * edge; ny = (ny / nl) * edge
      d[i] = (nx * 0.5 + 0.5) * 255
      d[i + 1] = (ny * 0.5 + 0.5) * 255
      d[i + 2] = 255
      d[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

let blurEl = null, feImageEl = null, dispEl = null
let dispBase = GLASS_DEFAULTS.disp, lastBand = -1
let wob = 0, lastScale = -1

function pushSvg(t) {
  if (blurEl !== null) blurEl.setAttribute('stdDeviation', Math.max(2, t.blur * 0.45).toFixed(1))
  if (feImageEl !== null && t.band !== lastBand) {
    lastBand = t.band
    try { feImageEl.setAttribute('href', normalMapURL(256, t.band / 100)) } catch (e) { /* canvas 不可用 */ }
  }
  dispBase = t.disp
  lastScale = -1
}

export function applyGlassTune(t) {
  const tune = t || loadGlassTune()
  const s = document.documentElement.style
  s.setProperty('--gv-veil', (tune.veil / 100).toFixed(3))
  s.setProperty('--gv-sat', (tune.sat / 100).toFixed(2))
  s.setProperty('--gv-blur', tune.blur + 'px')
  s.setProperty('--gv-blob', (tune.blob / 100).toFixed(2))
  s.setProperty('--gv-sheen', (tune.sheen / 100).toFixed(3))
  s.setProperty('--gv-rim', (tune.rim / 100).toFixed(3))
  pushSvg(tune)
  try { localStorage.setItem(TUNE_KEY, JSON.stringify(tune)) } catch (e) { /* 隐私模式 */ }
  return tune
}

function installDefs(url) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden'
  svg.innerHTML =
    '<defs><filter id="hst-liquid" x="-16%" y="-16%" width="132%" height="132%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur id="hst-blur" in="SourceGraphic" stdDeviation="11" result="b"/>' +
    '<feImage id="hst-norm" href="' + url + '" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="n"/>' +
    '<feDisplacementMap id="hst-disp" in="b" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter></defs>'
  document.body.appendChild(svg)
  blurEl = svg.querySelector('#hst-blur')
  feImageEl = svg.querySelector('#hst-norm')
  dispEl = svg.querySelector('#hst-disp')
}

export function initGlass() {
  applyGlassTune()
  const supported =
    (typeof CSS !== 'undefined' && CSS.supports && (CSS.supports('backdrop-filter', 'url(#a)') || CSS.supports('-webkit-backdrop-filter', 'url(#a)')))
  if (!supported) return
  try { installDefs(normalMapURL(256, loadGlassTune().band / 100)); lastBand = loadGlassTune().band } catch (e) { return }
  document.documentElement.classList.add('lg-on')
  applyGlassTune()  // 把参数推进 SVG 滤镜

  window.addEventListener('scroll', (e) => {
    const t = e.target
    if (!t || typeof t.getBoundingClientRect !== 'function') return
    const st = t.scrollTop || (t.scrollingElement && t.scrollingElement.scrollTop) || 0
    const prev = tops.get(t)
    tops.set(t, st)
    if (prev !== undefined) wob = Math.min(1, wob + Math.abs(st - prev) / 70)
  }, { capture: true, passive: true })

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

  const tops = new WeakMap()
  const prev = new WeakMap()
  function tick(now) {
    requestAnimationFrame(tick)
    if (document.hidden) return
    wob *= 0.9
    if (wob < 0.004) wob = 0
    const sc = dispBase + wob * 16
    if (dispEl !== null && Math.abs(sc - lastScale) > 0.15) {
      lastScale = sc
      dispEl.setAttribute('scale', sc.toFixed(1))
    }
    if (now - lastTouch > 2500) {
      const t = now / 1000
      tx = window.innerWidth * (0.5 + 0.42 * Math.sin(t * 0.23))
      ty = window.innerHeight * (0.45 + 0.4 * Math.sin(t * 0.31 + 1.3))
    }
    lx += (tx + tiltX * 120 - lx) * 0.12
    ly += (ty + tiltY * 120 - ly) * 0.12
    for (const sel of TARGETS) {
      for (const el of document.querySelectorAll(sel)) {
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