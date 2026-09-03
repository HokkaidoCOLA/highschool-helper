// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * PPT 生成共享库：版式常量 + ops 构造器 + 双渲染器（pptx / 同坐标 HTML 预览）。
 *
 * 用法脚本（make-ppt.mjs / make-ppt-guide.mjs）只声明 SLIDES，渲染逻辑在这里：
 *   renderPptx(SLIDES, { out, footer, title })   → 真 .pptx
 *   renderPreview(SLIDES, { out, footer })       → 1:1 坐标 HTML（1in=96px），供截图目检
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { zipSync, unzipSync } from 'fflate'

/**
 * OOXML 修正：pptxgenjs 会给同段落里每个带 options 的 run 都写一份 <a:pPr>，且可能
 * 出现在 <a:r> 之后。合法要求：每段至多一个 pPr、且必须是 <a:p> 的第一个子元素——
 * 违反者 PowerPoint 直接弹「内容有问题，尝试修复」。
 * 策略：逐段收集全部 pPr（含自闭合形态），只保留第一份并挪到段首，其余删除。
 */
function sanitizePptx(file) {
  const buf = readFileSync(file)
  const zip = unzipSync(buf)
  let fixed = 0
  const PPR = /<a:pPr(?:[^>]*\/|[^>]*>[\s\S]*?<\/a:pPr>)/g
  for (const name of Object.keys(zip)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue
    const xml = new TextDecoder().decode(zip[name])
    const out = xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (m, inner) => {
      const found = inner.match(PPR) || []
      if (found.length === 0) return m
      const head = inner.startsWith(found[0])
      if (found.length === 1 && head) return m // 已合法
      fixed += found.length - (head ? 1 : 0) + (head ? 0 : 1)
      const stripped = inner.replace(PPR, '')
      return '<a:p>' + found[0] + stripped + '</a:p>'
    })
    zip[name] = new TextEncoder().encode(out)
  }
  if (fixed > 0) {
    const entries = {}
    for (const k of Object.keys(zip)) entries[k] = zip[k]
    writeFileSync(file, zipSync(entries, { level: 6 }))
  }
  console.log('OOXML 修正：pPr 归位/去重 ×' + fixed)
}

/* ── 版式常量：统一网格 ─────────────────────────────────────────────────── */
export const BRAND = '2F6DF6', PURPLE = '7C5CFA', DEEP = '1E46C0'
export const INK = '171A21', INK2 = '5A6270', SOFT = 'DCE7FF', FAINT = '9AA3B2'
export const BG = 'F7F9FE', CARD = 'FFFFFF', LINE = 'E3E9F5'
export const OK = '1FA97C', WARN = 'E08B1A', RED = 'DC2626'
export const FONT = 'Microsoft YaHei'
export const W = 13.333, H = 7.5
export const M = 0.62
export const CW = W - 2 * M
export const TOP = 1.42, BOT = 6.92
export const AR = 2480 / 1640
export const CAR = 1372 / 1040 // 画布截图宽高比
export const HALF = (CW - 0.42) / 2
export const X2 = M + HALF + 0.42
export const PIC_W = 6.75, PIC_X = W - M - PIC_W, PIC_Y = TOP + (BOT - TOP - PIC_W / AR) / 2

/* ── ops 构造器 ─────────────────────────────────────────────────────────── */
export const rect = (x, y, w, h, color, o = {}) => ({ k: 'rect', x, y, w, h, color, t: o.t ?? 0, r: o.r ?? 0.1, line: o.line, shadow: o.shadow })
export const text = (x, y, w, h, runs, o = {}) => ({ k: 'text', x, y, w, h, runs, size: o.size ?? 12, bold: o.bold, color: o.color ?? INK, align: o.align ?? 'left', valign: o.valign ?? 'top', mono: o.mono, spacing: o.spacing, lh: o.lh ?? 1.14 })
export const pic = (path, x, y, w, o = {}) => ({ k: 'pic', path, x, y, w, h: w / (o.ar ?? AR), cap: o.cap })
export const table = (x, y, w, rows, o = {}) => ({ k: 'table', x, y, w, rows, colW: o.colW, rowH: o.rowH ?? 0.42, size: o.size ?? 10.5 })
export const B = (lead, rest, color) => ({ lead, text: rest, color })
export const blist = (x, y, w, h, items, o = {}) => ({ k: 'blist', x, y, w, h, items, size: o.size ?? 12, lh: o.lh ?? 1.16 })
export const bg = (color) => ({ k: 'bg', color })
export const hline = (x, y, w, color) => ({ k: 'hline', x, y, w, color: color ?? LINE })
export const icon = (path, x, y, w, o = {}) => ({ k: 'icon', path, x, y, w, chip: o.chip })

/* ── 内容页页眉 ─────────────────────────────────────────────────────────── */
export function chrome(title, kicker) {
  return [
    rect(M + 0.02, 0.6, 0.15, 0.44, BRAND, { r: 0.06 }),
    text(M + 0.32, 0.46, 9.2, 0.74, title, { size: 23, bold: true, valign: 'middle' }),
    kicker ? text(W - M - 4.6, 0.5, 4.6, 0.66, kicker, { size: 10.5, color: INK2, align: 'right', valign: 'middle' }) : null,
    hline(M, 1.18, CW),
  ].filter(Boolean)
}

/* ═════════ 渲染器 A：pptx ═════════ */
export async function renderPptx(SLIDES, opts) {
  const { out, footer, title } = opts
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'W169', width: W, height: H })
  pptx.layout = 'W169'
  pptx.author = '高中助学'; pptx.company = 'dev.hst'; pptx.title = title || '高中助学'
  const SHADOW = { type: 'outer', blur: 10, offset: 2, angle: 90, color: '93A5C8', opacity: 0.25 }
  let pageNo = 0
  for (const ops of SLIDES) {
    const s = pptx.addSlide()
    s.background = { color: BG }
    pageNo += 1
    for (const op of ops) {
      if (op.k === 'bg') s.background = { color: op.color }
      else if (op.k === 'rect') s.addShape('roundRect', { x: op.x, y: op.y, w: op.w, h: op.h, rectRadius: op.r, fill: { color: op.color, transparency: op.t }, line: op.line ? { color: op.line, pt: 0.75 } : { type: 'none' }, shadow: op.shadow ? SHADOW : undefined })
      else if (op.k === 'hline') s.addShape('line', { x: op.x, y: op.y, w: op.w, h: 0, line: { color: op.color, pt: 1 } })
      else if (op.k === 'text' || op.k === 'blist') {
        const runs = op.k === 'blist'
          ? op.items.flatMap((it, i) => {
              const bullet = { code: '2022', color: BRAND, indent: 10 }
              const out2 = []
              if (it.lead) out2.push({ text: it.lead, options: { bold: true, color: it.color ?? INK, bullet, paraSpaceBefore: i ? 8 : 0 } })
              out2.push({ text: it.text ?? '', options: { color: it.lead ? INK2 : INK, bold: !it.lead, bullet: it.lead ? false : bullet, paraSpaceBefore: it.lead ? 0 : (i ? 8 : 0) } })
              return out2
            })
          : (typeof op.runs === 'string'
              ? [{ text: op.runs, options: { breakLine: false } }]
              : op.runs.flatMap((r) => {
                  const out2 = []
                  if (r.lead) out2.push({ text: r.lead, options: { bold: true, color: r.warn ? WARN : (r.leadColor ?? INK) } })
                  out2.push({ text: r.text ?? '', options: { color: r.soft ? SOFT : (r.lead ? INK2 : (r.color ?? INK)), breakLine: true } })
                  return out2
                }))
        s.addText(runs, { fontFace: op.mono ? 'Consolas' : FONT, fontSize: op.size, color: op.color, align: op.align, valign: op.valign, lineSpacingMultiple: op.lh, charSpacing: op.spacing, x: op.x, y: op.y, w: op.w, h: op.h })
      }
      else if (op.k === 'icon') {
        if (op.chip) s.addShape('roundRect', { x: op.x - 0.14, y: op.y - 0.14, w: op.w + 0.28, h: op.w + 0.28, rectRadius: 0.22, fill: { color: CARD }, line: { type: 'none' } })
        s.addImage({ path: op.path, x: op.x, y: op.y, w: op.w, h: op.w })
      }
      else if (op.k === 'pic') {
        s.addImage({ path: op.path, x: op.x, y: op.y, w: op.w, h: op.h, shadow: { type: 'outer', blur: 12, offset: 3, angle: 90, color: '8FA3C8', opacity: 0.35 } })
        s.addShape('roundRect', { x: op.x, y: op.y, w: op.w, h: op.h, rectRadius: 0.06, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: LINE, pt: 1 } })
        if (op.cap) s.addText(op.cap, { x: op.x, y: op.y + op.h + 0.06, w: op.w, h: 0.3, fontFace: FONT, fontSize: 9.5, color: FAINT, align: 'center' })
      }
      else if (op.k === 'table') {
        const rows = op.rows.map((r) => r.map((c) => ({ text: c.t, options: c.h ? { bold: true, color: CARD, fill: { color: BRAND }, align: 'center' } : { color: INK, fill: { color: CARD } } })))
        s.addTable(rows, { fontFace: FONT, fontSize: op.size, border: { pt: 0.75, color: LINE }, valign: 'middle', x: op.x, y: op.y, w: op.w, colW: op.colW, rowH: op.rowH })
      }
    }
    if (ops[0] && ops[0].k !== 'bg') s.addText(`${footer}　${pageNo} / ${SLIDES.length}`, { x: W - 4.6, y: H - 0.42, w: 4.0, h: 0.3, fontSize: 9, color: FAINT, align: 'right', fontFace: FONT })
  }
  await pptx.writeFile({ fileName: out })
  sanitizePptx(out)
  console.log('PPT 已生成 →', out)
}

/* ═════════ 渲染器 B：同坐标 HTML 预览（1in=96px）═════════ */
function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;') }
export function renderPreview(SLIDES, opts) {
  const { out, footer } = opts
  const PX = 96
  const divs = SLIDES.map((ops, i) => {
    let b = BG
    const parts = []
    for (const op of ops) {
      if (op.k === 'bg') b = op.color
      else if (op.k === 'rect') parts.push(`<div class="r" style="left:${op.x * PX}px;top:${op.y * PX}px;width:${op.w * PX}px;height:${op.h * PX}px;background:#${op.color};opacity:${1 - op.t / 100};border-radius:${op.r * PX}px;${op.line ? `border:1px solid #${op.line};` : ''}${op.shadow ? 'box-shadow:0 2px 10px rgba(147,165,200,.25);' : ''}"></div>`)
      else if (op.k === 'hline') parts.push(`<div class="r" style="left:${op.x * PX}px;top:${op.y * PX}px;width:${op.w * PX}px;height:1px;background:#${op.color};"></div>`)
      else if (op.k === 'icon') parts.push(`<div class="r" style="position:absolute;left:${(op.x - 0.14) * PX}px;top:${(op.y - 0.14) * PX}px;width:${(op.w + 0.28) * PX}px;height:${(op.w + 0.28) * PX}px;background:#fff;border-radius:21px"></div><img class="r" src="file://${op.path}" style="left:${op.x * PX}px;top:${op.y * PX}px;width:${op.w * PX}px;height:${op.w * PX}px">`)
      else if (op.k === 'pic') {
        parts.push(`<img class="r" src="file://${op.path}" style="left:${op.x * PX}px;top:${op.y * PX}px;width:${op.w * PX}px;height:${op.h * PX}px;box-shadow:0 3px 12px rgba(143,163,200,.35);border:1px solid #${LINE};border-radius:6px;object-fit:fill">`)
        if (op.cap) parts.push(`<div class="r t" style="left:${op.x * PX}px;top:${(op.y + op.h + 0.06) * PX}px;width:${op.w * PX}px;height:${0.3 * PX}px;font-size:${9.5 * 96 / 72}px;color:#${FAINT};text-align:center">${esc(op.cap)}</div>`)
      }
      else if (op.k === 'table') {
        const tr = op.rows.map((r) => `<tr>${r.map((c, ci) => `<td style="width:${op.colW[ci] * PX}px;background:${c.h ? '#' + BRAND : '#fff'};color:${c.h ? '#fff' : '#' + INK};font-weight:${c.h ? 700 : 400};text-align:${c.h ? 'center' : 'left'}">${esc(c.t)}</td>`).join('')}</tr>`).join('')
        parts.push(`<table class="r" style="left:${op.x * PX}px;top:${op.y * PX}px;width:${op.w * PX}px;font-size:${op.size * 96 / 72}px"><tbody>${tr}</tbody></table>`)
      }
      else if (op.k === 'blist') {
        const items = op.items.map((it) => `<div class="bl" style="margin-top:8px">${it.lead ? `<b style="color:#${it.color ?? INK}">• ${esc(it.lead)}</b><span style="color:#${INK2}">${esc(it.text ?? '')}</span>` : `<b style="color:#${INK}">• ${esc(it.text ?? '')}</b>`}</div>`).join('')
        parts.push(`<div class="r t" style="left:${op.x * PX}px;top:${op.y * PX}px;width:${op.w * PX}px;min-height:${op.h * PX}px;font-size:${op.size * 96 / 72}px;line-height:${op.lh}">${items}</div>`)
      }
      else if (op.k === 'text') {
        const html = typeof op.runs === 'string'
          ? op.runs.split('\n').map((ln) => `<div>${esc(ln)}</div>`).join('')
          : op.runs.map((r) => `<div>${r.lead ? `<b style="color:#${r.warn ? WARN : (r.leadColor ?? INK)}">${esc(r.lead)}</b>` : ''}<span style="color:#${r.soft ? SOFT : (r.lead ? INK2 : (r.color ?? INK))}">${esc(r.text ?? '')}</span></div>`).join('')
        parts.push(`<div class="r t" style="left:${op.x * PX}px;top:${op.y * PX}px;width:${op.w * PX}px;height:${op.h * PX}px;font-size:${op.size * 96 / 72}px;line-height:${op.lh};color:#${op.color};font-family:${op.mono ? 'Consolas,monospace' : '-apple-system,PingFang SC,Microsoft YaHei'};text-align:${op.align};letter-spacing:${op.spacing ? op.spacing * 0.75 : 0}px;display:${op.valign === 'middle' ? 'flex;flex-direction:column;justify-content:center' : 'block'};${op.bold ? 'font-weight:700;' : ''}">${html}</div>`)
      }
    }
    const ft = ops[0] && ops[0].k !== 'bg' ? `<div class="r t" style="left:${(W - 4.6) * PX}px;top:${(H - 0.42) * PX}px;width:${4.0 * PX}px;height:${0.3 * PX}px;font-size:12px;color:#${FAINT};text-align:right">${esc(footer)}　${i + 1} / ${SLIDES.length}</div>` : ''
    return `<section class="slide" data-n="${i + 1}" style="background:#${b}">${parts.join('')}${ft}</section>`
  })
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}body{background:#333;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#${INK}}
    .slide{position:relative;width:${W * PX}px;height:${H * PX}px;overflow:hidden;margin:24px auto;flex:none}
    .r{position:absolute}.t{overflow:visible}
    img{object-fit:cover}
    table{border-collapse:collapse}td{border:1px solid #${LINE};padding:4px 8px;white-space:normal;line-height:1.3}
    .bl b{font-weight:700}
  </style>${divs.join('')}`
  writeFileSync(out, html)
  console.log('预览 HTML →', out)
}
