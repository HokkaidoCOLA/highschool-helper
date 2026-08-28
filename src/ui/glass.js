// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 液态玻璃实时光效引擎 v4——按 BiliPai(jay3-yy) 的 AGSL 配方移植到 WebView。
 *
 * BiliPai 核心（Lens.kt ← Kyant0/AndroidLiquidGlass）的三件套数学，这里全部还原：
 * ① 圆角矩形 SDF 的解析梯度（不是有限差分）→ 折射方向；
 * ② 球面透镜幅度曲线 circleMap(x)=1-√(1-x²) → 边缘带内弯折、中心不动，
 *    外加 depthEffect 中心凸起（normalize(coord) 分量）产生「厚玻璃」放大感；
 * ③ 色散：B 通道用更大的位移 scale 二次采样 → 边缘蓝移彩虹（近似其 7-tap 配方）。
 * 另移植其「滚动联动折射」：滚动速度注入 feDisplacementMap scale，停下即衰减。
 *
 * 高光层是我们自己的加分项（BiliPai 没有）：全局光源跟手指/巡游/陀螺仪。
 * 不支持 backdrop-filter url() 的环境静默退回 v2 blur 玻璃。
 */

const TARGETS = ['.appTabs', '.composer', '.chatTop', '.hero', '.chatSide', '.drawer', '.modal', '.demoModal']

/* 对齐 BiliPai BALANCED 档的调参 */
const TUNE = {
  blurStd: 4,        // ≈ 其 backdropBlurRadius 4dp
  dispScale: 30,     // ≈ 其 refractionAmount 24（RG 通道）
  band: 0.20,        // ≈ 其 refractionHeight：边缘带宽度（归一化）
  corner: 0.16,      // 法线贴图圆角比例
  depth: 0.35,       // depthEffect 中心凸起强度
  wobbleMax: 16,     // 滚动联动：scale 额外上限
}

const circleMap = (x) => 1 - Math.sqrt(Math.max(0, 1 - x * x))

/* 解析法：圆角矩形 SDF 梯度（同 Lens.kt gradSdRoundedRect） */
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

function normalMapURL(size) {
  const { band, corner, depth } = TUNE
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
      const sd = sdf(u, v, half, corner)
      const i = (y * size + x) * 4
      if (sd >= 0) { d[i] = 128; d[i + 1] = 128; d[i + 2] = 255; d[i + 3] = 255; continue }
      const edge = circleMap(Math.max(0, Math.min(1, 1 + sd / band))) // sd<0：0 边缘→1 带内
      const [gx, gy] = gradSDF(u, v, half, Math.min(corner * 1.5, half * 0.9))
      const len = Math.hypot(u, v) || 1
      let nx = gx + depth * (u / len)
      let ny = gy + depth * (v / len)
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

let dispRG = null
function installDefs(url) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden'
  /* BiliPai 的折中：24dp 大外壳（我们的 Dock/顶栏/弹层）保持无色散——
     白色玻璃上分色采样必然糊出黄绿边；色散只属于小移动件，我们没有这种
     元素，故整条链收敛为纯球面透镜。 */
  svg.innerHTML =
    '<defs><filter id="hst-liquid" x="-16%" y="-16%" width="132%" height="132%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="' + TUNE.blurStd + '" result="b"/>' +
    '<feImage href="' + url + '" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="n"/>' +
    '<feDisplacementMap id="hst-drg" in="b" in2="n" scale="' + TUNE.dispScale + '" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter></defs>'
  document.body.appendChild(svg)
  dispRG = svg.querySelector('#hst-drg')
}
export function initGlass() {
  const supported =
    (typeof CSS !== 'undefined' && CSS.supports && (CSS.supports('backdrop-filter', 'url(#a)') || CSS.supports('-webkit-backdrop-filter', 'url(#a)')))
  if (!supported) return
  try { installDefs(normalMapURL(256)) } catch (e) { return }
  document.documentElement.classList.add('lg-on')

  /* ── 滚动联动折射（BiliPai scrollCoupledRefractionAmount 同款） ── */
  let wob = 0, lastScale = -1
  const tops = new WeakMap()
  window.addEventListener('scroll', (e) => {
    const t = e.target
    if (!t || typeof t.getBoundingClientRect !== 'function') return
    const st = t.scrollTop || (t.scrollingElement && t.scrollingElement.scrollTop) || 0
    const prev = tops.get(t)
    tops.set(t, st)
    if (prev !== undefined) wob = Math.min(1, wob + Math.abs(st - prev) / 70)
  }, { capture: true, passive: true })

  /* ── 全局光源 ── */
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
    /* 滚动晃动注入折射强度，指数衰减 */
    wob *= 0.9
    if (wob < 0.004) wob = 0
    const s = TUNE.dispScale + wob * TUNE.wobbleMax
    if (Math.abs(s - lastScale) > 0.15 && dispRG !== null) {
      lastScale = s
      dispRG.setAttribute('scale', s.toFixed(1))
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