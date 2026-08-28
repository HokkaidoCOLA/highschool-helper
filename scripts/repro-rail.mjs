// 横屏左侧导航栏：独立滚动区验证（溢出场景 340px + 正常场景 415px）
import puppeteer from 'puppeteer-core';
const exe = '.browser/chrome-headless-shell/mac_arm64-152.0.7977.64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage();
let fail = 0;
const ok = (label, cond, extra) => { if (!cond) { fail++; console.log('FAIL ' + label + (extra ? ' :: ' + extra : '')); } else console.log('ok   ' + label); };
async function open(h) {
  await page.setViewport({ width: 914, height: h, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
}
// ── 场景 A：正常横屏 415px —— 8 项收紧后全可见、无溢出、无 VBar ──
await open(415);
let m = await page.evaluate(() => {
  const de = document.documentElement, tabs = document.querySelector('.appTabs');
  const t = tabs.children[tabs.children.length - 1];
  return { docScroll: de.scrollHeight > de.clientHeight, overflow: tabs.scrollHeight - tabs.clientHeight,
    lastBottom: Math.round(t.getBoundingClientRect().bottom), innerH: innerHeight,
    vbar: !!document.querySelector('.railWrap .vbarTrack') };
});
ok('A 整页不可滚', !m.docScroll, JSON.stringify(m));
ok('A 导航栏无溢出', m.overflow <= 0, 'overflow=' + m.overflow);
ok('A 设置项完整可见', m.lastBottom <= m.innerH, 'bottom=' + m.lastBottom);
ok('A 无溢出则无 VBar', !m.vbar);
// ── 场景 B：矮视口 340px（模拟系统字体放大/小屏）—— rail 独立滚、外面纹丝不动 ──
await open(340);
m = await page.evaluate(() => {
  const de = document.documentElement, tabs = document.querySelector('.appTabs');
  const cs = getComputedStyle(tabs);
  return { docScroll: de.scrollHeight > de.clientHeight, overflow: tabs.scrollHeight - tabs.clientHeight,
    overflowY: cs.overflowY, overscroll: cs.overscrollBehaviorY,
    vbar: !!document.querySelector('.railWrap .vbarTrack') };
});
ok('B 整页仍不可滚', !m.docScroll, JSON.stringify(m));
ok('B 导航栏溢出', m.overflow > 8, 'overflow=' + m.overflow);
ok('B 栏 overflow-y:auto', m.overflowY === 'auto', m.overflowY);
ok('B overscroll contain', m.overscroll === 'contain', m.overscroll);
ok('B 溢出出现 VBar', m.vbar);
const c = await page.evaluate(() => {
  const tabs = document.querySelector('.appTabs');
  const g = (s) => Math.round(document.querySelector(s).getBoundingClientRect().top);
  const before = { rail: g('.appTabs'), header: g('.appHeader'), main: g('.appMain'), lastBottom: Math.round(tabs.children[7].getBoundingClientRect().bottom) };
  tabs.scrollTop = 9999;
  const after = { rail: g('.appTabs'), header: g('.appHeader'), main: g('.appMain'), lastBottom: Math.round(tabs.children[7].getBoundingClientRect().bottom), railScrolled: tabs.scrollTop };
  return { before, after, innerH: innerHeight };
});
ok('B 滚栏后设置项进入视野', c.after.lastBottom <= c.innerH + 1, JSON.stringify(c.after));
ok('B 头部/主区零位移', c.before.header === c.after.header && c.before.main === c.after.main, JSON.stringify({ b: c.before, a: c.after }));
ok('B 栏自身确实滚了', c.after.railScrolled > 0, String(c.after.railScrolled));
await browser.close();
console.log(fail === 0 ? 'RAIL-OK' : 'RAIL-FAIL x' + fail);
process.exit(fail === 0 ? 0 : 1);
