// 桌面 UI 优化验收：1240×820 布局断言 + 逐页截图 + 手机横/竖屏回归
// 前置：npx vite preview --port 4317（或任意静态服务把 dist/ 供到 4317）
import puppeteer from 'puppeteer-core'
import { mkdirSync, existsSync, readdirSync } from 'node:fs'

let bin = null
for (const d of readdirSync('.browser/chrome-headless-shell')) {
  const p = `.browser/chrome-headless-shell/${d}/chrome-headless-shell`
  if (existsSync(p)) bin = p
}
mkdirSync('.preview/desktop', { recursive: true })

const browser = await puppeteer.launch({ executablePath: bin, args: ['--no-sandbox'] })
let fail = 0
const ok = (label, cond, extra) => { if (!cond) { fail++; console.log('FAIL ' + label + (extra ? ' :: ' + extra : '')) } else console.log('ok   ' + label) }

const page = await browser.newPage()
const TABS = ['chat', 'today', 'review', 'library', 'demos', 'docs', 'stats', 'settings']
const go = async (i) => { await page.evaluate((n) => document.querySelectorAll('.appTab')[n].click(), i); await new Promise((r) => setTimeout(r, 350)) }

// ── A. 桌面 1240×820（鼠标 + 无触摸）──
await page.setViewport({ width: 1240, height: 820, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 900))
ok('A 媒体查询命中 hover 环境', await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches))
ok('A 媒体查询命中大屏', await page.evaluate(() => matchMedia('(min-width: 900px) and (min-height: 561px)').matches))

await go(0) // chat
let m = await page.evaluate(() => {
  const cs = (s, p) => getComputedStyle(document.querySelector(s))[p]
  const stream = document.querySelector('.chatStream')
  return { fullBleedPad: cs('.appMain', 'paddingLeft'), padL: parseFloat(cs('.chatStream', 'paddingLeft')),
    dock: (() => { const r = document.querySelector('.appTabs').getBoundingClientRect(); return { w: r.width, centered: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2 } })() }
})
ok('A chat 保持全出血（padding 0）', m.fullBleedPad === '0px', 'pad=' + m.fullBleedPad)
// 侧栏占 216 后主区 ~1024：限宽边距 = 512-430 ≈ 82px（消息列收束到 ~860）
ok('A chatStream 限宽边距 ≥70', m.padL >= 70, 'padL=' + m.padL)
ok('A Dock 收宽 ≤780', m.dock.w <= 780.5, 'w=' + m.dock.w)
ok('A Dock 居中', m.dock.centered, JSON.stringify(m.dock))
await page.screenshot({ path: '.preview/desktop/a-chat.png' })
// 侧栏：桌面横屏默认常驻，点汉堡折叠、再点展开
m = await page.evaluate(() => ({ shown: getComputedStyle(document.querySelector('.chatSide')).display !== 'none' }))
ok('A 桌面侧栏默认常驻', m.shown)
await page.evaluate(() => document.querySelectorAll('.chatTop .iconBtn')[0].click())
await new Promise((r) => setTimeout(r, 350))
const collapsed = await page.evaluate(() => getComputedStyle(document.querySelector('.chatSide')).display === 'none')
ok('A 汉堡键可折叠侧栏', collapsed)
await page.evaluate(() => document.querySelectorAll('.chatTop .iconBtn')[0].click())
await new Promise((r) => setTimeout(r, 250))

await go(1) // today
m = await page.evaluate(() => {
  const t = document.querySelector('.pageToday')
  const cs = getComputedStyle(t)
  const r = t.getBoundingClientRect()
  return { disp: cs.display, cols: cs.gridTemplateColumns.split(' ').length, w: r.width, centered: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 2 }
})
ok('A 今日双列网格', m.disp === 'grid' && m.cols === 2, JSON.stringify(m))
ok('A 今日限宽 ≤900 且居中', m.w <= 901 && m.centered, JSON.stringify(m))
await page.screenshot({ path: '.preview/desktop/a-today.png' })

await go(4) // demos
m = await page.evaluate(() => {
  const d = document.querySelector('.pageDemos')
  const cs = getComputedStyle(d)
  const stage = document.querySelector('.pageDemos > .stageColWrap')
  const vb = [...document.querySelectorAll('.vbarTrack')].map((e) => getComputedStyle(e).display)
  return { disp: cs.display, cols: cs.gridTemplateColumns.split(' ').length, pos: stage && getComputedStyle(stage).position, vbarHidden: vb.length === 0 || vb.every((x) => x === 'none'), w: d.getBoundingClientRect().width }
})
ok('A 演示双列网格', m.disp === 'grid' && m.cols === 2, JSON.stringify(m))
ok('A 演示画布列 sticky', m.pos === 'sticky', 'pos=' + m.pos)
ok('A VBar 在鼠标环境隐藏', m.vbarHidden)
ok('A 演示网格页放宽到 1220', m.w > 900 && m.w <= 1221, 'w=' + m.w)
await page.screenshot({ path: '.preview/desktop/a-demos.png' })

await go(3) // library
m = await page.evaluate(() => {
  const root = document.querySelector('.appMain').firstElementChild
  return { w: root.getBoundingClientRect().width }
})
ok('A 题库限宽 ≤860', m.w <= 861, 'w=' + m.w)
await page.screenshot({ path: '.preview/desktop/a-library.png' })

await go(2) // review（空态也应居中不破版）
await page.screenshot({ path: '.preview/desktop/a-review.png' })
await go(6); await page.screenshot({ path: '.preview/desktop/a-stats.png' })
await go(7); await page.screenshot({ path: '.preview/desktop/a-settings.png' })

// 悬停态真的会改样式？（对 .appTab 开关做前后背景对比）
const hov = await page.evaluate(async () => {
  const el = document.querySelectorAll('.appTab')[5]
  const before = getComputedStyle(el).backgroundColor
  return { before, hasRule: [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.media && r.conditionText?.includes('pointer: fine') && r.cssText.includes('appTab')) } catch { return false } }) }
})
ok('A hover 规则已装载', hov.hasRule)

// ── B. 手机横屏 914×415：紧凑块照常，桌面块不得干扰 ──
await page.setViewport({ width: 914, height: 415, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true })
await page.reload({ waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 900))
await go(4)
m = await page.evaluate(() => {
  const d = document.querySelector('.pageDemos')
  const cs = getComputedStyle(d)
  return { disp: cs.display, cols: cs.gridTemplateColumns.split(' ').length, vbarShown: [...document.querySelectorAll('.vbarTrack')].some((e) => getComputedStyle(e).display !== 'none') }
})
ok('B 手机横屏演示仍是双列', m.disp === 'grid' && m.cols === 2, JSON.stringify(m))
await page.screenshot({ path: '.preview/desktop/b-phone-landscape-demos.png' })

// ── C. 手机竖屏 393×852：一切默认样式，无网格无限宽副作用 ──
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true })
await page.reload({ waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 900))
await go(1)
m = await page.evaluate(() => {
  const t = document.querySelector('.pageToday')
  const cs = getComputedStyle(t)
  const stream = getComputedStyle(document.querySelector('.appMain'))
  return { disp: cs.display, w: t.getBoundingClientRect().width, pad: stream.paddingLeft }
})
await go(0)
ok('C 今日竖屏仍是单列流式', m.disp !== 'grid', JSON.stringify(m))
ok('C 竖屏限宽无副作用', m.w > 350, 'w=' + m.w)
await page.screenshot({ path: '.preview/desktop/c-phone-today.png' })

await browser.close()
console.log(fail === 0 ? 'DESKTOP-UI-OK' : 'DESKTOP-UI-FAIL x' + fail)
process.exit(fail === 0 ? 0 : 1)
