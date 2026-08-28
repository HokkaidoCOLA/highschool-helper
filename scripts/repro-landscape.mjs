// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 无头复现「横屏演示显示 bug」：OPPO 横屏 CSS 视口（914×415 dpr2.625）打开演示页
 * → 点样例 → 截图；切竖屏 → 截图；再切回横屏 → 截图。配合 vite preview 使用。
 * 用法：node scripts/repro-landscape.mjs [url，默认 http://127.0.0.1:4317/]
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function findShell() {
  const base = new URL('../.browser', import.meta.url).pathname
  for (const dir of readdirSync(base)) {
    if (!dir.startsWith('chrome-headless-shell')) continue
    const inner = readdirSync(join(base, dir))
    for (const arch of inner) {
      const p = join(base, dir, arch, 'chrome-headless-shell')
      if (existsSync(p)) return p
      const p2 = join(base, dir, arch, 'chrome-headless-shell-mac-' + (process.arch === 'arm64' ? 'arm64' : 'x64') + '/chrome-headless-shell')
      if (existsSync(p2)) return p2
    }
  }
  throw new Error('未找到 chrome-headless-shell，先跑 npx @puppeteer/browsers install')
}

const URL_BASE = process.argv[2] || 'http://127.0.0.1:4317/'
const browser = await puppeteer.launch({ executablePath: findShell(), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()))
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message))

const LAND = { width: 914, height: 415, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true }
const PORT = { width: 415, height: 914, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true }

await page.setViewport(LAND)
await page.goto(URL_BASE, { waitUntil: 'networkidle0' })
// 进演示页
await page.evaluate(() => { [...document.querySelectorAll('.appTab')].find((b) => b.textContent.includes('演示')).click() })
await new Promise((r) => setTimeout(r, 600))
// 点第一个样例
await page.evaluate(() => { document.querySelectorAll('.demoCard')[0].click() })
await new Promise((r) => setTimeout(r, 1800))
await page.screenshot({ path: '.preview/lr-1-land-open.png' })
// 画布几何体检：canvas 尺寸 vs 容器尺寸 vs 视口
const geo1 = await page.evaluate(() => {
  const cv = document.querySelector('.hst canvas')
  const host = document.querySelector('.demoHost')
  const r = cv ? cv.getBoundingClientRect() : null
  const hr = host ? host.getBoundingClientRect() : null
  return { canvas: r && { x: r.x, y: r.y, w: r.width, h: r.height }, host: hr && { x: hr.x, y: hr.y, w: hr.width, h: hr.height }, vw: innerWidth, vh: innerHeight }
})
console.log('LAND:', JSON.stringify(geo1))
// 切竖屏
await page.setViewport(PORT)
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: '.preview/lr-2-portrait.png' })
const geo2 = await page.evaluate(() => {
  const cv = document.querySelector('.hst canvas')
  const r = cv ? cv.getBoundingClientRect() : null
  const host = document.querySelector('.demoHost')
  const hr = host ? host.getBoundingClientRect() : null
  return { canvas: r && { x: r.x, y: r.y, w: r.width, h: r.height }, host: hr && { x: hr.x, y: hr.y, w: hr.width, h: hr.height }, vw: innerWidth, vh: innerHeight }
})
console.log('PORT:', JSON.stringify(geo2))
// 再切回横屏
await page.setViewport(LAND)
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: '.preview/lr-3-land-back.png' })
const geo3 = await page.evaluate(() => {
  const cv = document.querySelector('.hst canvas')
  const r = cv ? cv.getBoundingClientRect() : null
  return { canvas: r && { x: r.x, y: r.y, w: r.width, h: r.height }, vw: innerWidth, vh: innerHeight }
})
console.log('LAND2:', JSON.stringify(geo3))
// 关键断言：横屏滚到底，步骤说明区能否进入视口（sticky 列溢出不可达即 bug）
const reach = await page.evaluate(() => {
  return new Promise((r) => {
    const step = document.querySelector('.hst_step')
    const scroller = document.querySelector('.demoStageCol') || document.querySelector('.appMain')
    scroller.scrollTop = scroller.scrollHeight
    setTimeout(() => {
      const b = step.getBoundingClientRect()
      r({ bottom: Math.round(b.bottom), vh: innerHeight, visible: b.bottom <= innerHeight + 1 && b.top >= -1 })
    }, 400)
  })
})
console.log('STEP-VISIBILITY:', JSON.stringify(reach))
await page.screenshot({ path: '.preview/lr-4-land-scrolled.png' })
console.log('console logs:', logs.slice(-8).join(' | ') || '(none)')
await browser.close()