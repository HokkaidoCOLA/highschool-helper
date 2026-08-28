// 验证：横屏侧栏分栏常驻 / 竖屏覆盖抽屉。用法：node scripts/repro-sidebar.mjs（需 vite preview 4317）
import puppeteer from 'puppeteer-core'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const base = new URL('../.browser', import.meta.url).pathname
let exe = null
for (const d of readdirSync(base)) {
  const p = join(base, d)
  if (!existsSync(p)) continue
  for (const a of readdirSync(p)) {
    const c = join(p, a, 'chrome-headless-shell')
    if (existsSync(c)) exe = c
  }
}
if (exe === null) { console.error('no shell'); process.exit(1) }
const browser = await puppeteer.launch({ executablePath: exe, args: ['--no-sandbox'] })
const page = await browser.newPage()
const LAND = { width: 914, height: 415, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true }
const PORT = { width: 415, height: 914, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true }
await page.setViewport(LAND)
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'networkidle0' })
// 先建两个会话方便看列表
await page.evaluate(() => { [...document.querySelectorAll('.appTab')].find((b) => b.textContent.includes('聊天')).click() })
await new Promise((r) => setTimeout(r, 400))
const geo = await page.evaluate(() => {
  const side = document.querySelector('.chatSide')
  const r = side.getBoundingClientRect()
  const main = document.querySelector('.chatMain').getBoundingClientRect()
  return { sideVisible: r.width > 150, sideW: Math.round(r.width), mainX: Math.round(main.x), sameRow: Math.abs(main.x - r.right) < 3 }
})
console.log('LAND:', JSON.stringify(geo))
await page.screenshot({ path: '.preview/sb-1-landscape.png' })
// 竖屏：侧栏应隐藏，☰ 打开抽屉
await page.setViewport(PORT)
await new Promise((r) => setTimeout(r, 500))
const p2 = await page.evaluate(() => {
  const side = document.querySelector('.chatSide')
  const hidden = side.getBoundingClientRect().width === 0
  document.querySelector('.chatTop .iconBtn').click()
  return hidden
})
await new Promise((r) => setTimeout(r, 500))
const drawer = await page.evaluate(() => {
  const d = document.querySelector('.drawer')
  return d ? d.className : null
})
console.log('PORT: sideHidden=', p2, 'drawer=', drawer)
await page.screenshot({ path: '.preview/sb-2-portrait-drawer.png' })
await browser.close()
