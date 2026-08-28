// 聊天页高度链守卫 v5：悬浮结构断言（drawer 脱流 / chatSplit 吃满 / 输入条悬浮位正确）
import puppeteer from 'puppeteer-core';
const exe = '.browser/chrome-headless-shell/mac_arm64-152.0.7977.64/chrome-headless-shell';
const browser = await puppeteer.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage();
let fail = 0;
const ok = (label, cond, extra) => { if (!cond) { fail++; console.log('FAIL ' + label + (extra ? ' :: ' + extra : '')); } else console.log('ok   ' + label); };
for (const [w, h, name] of [[914, 415, 'LAND'], [412, 915, 'PORT']]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1200));
  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const rect = (s) => { const e = q(s); return e ? e.getBoundingClientRect() : null };
    const comp = rect('.composer'), dock = rect('.appTabs');
    return { lgOn: document.documentElement.classList.contains('lg-on'),
      drawerPos: getComputedStyle(q('.drawer')).position,
      splitH: Math.round(rect('.chatSplit').height), mainH: Math.round(rect('.appMain').height),
      dockPos: getComputedStyle(q('.appTabs')).position,
      compBottom: Math.round(comp.bottom), dockTop: Math.round(dock.top), vh: innerHeight };
  });
  ok(name + ' 引擎已激活', m.lgOn);
  ok(name + ' drawer 保持 fixed 脱流', m.drawerPos === 'fixed', m.drawerPos);
  ok(name + ' chatSplit 吃满主区', m.splitH >= m.mainH - 24, m.splitH + '/' + m.mainH);
  ok(name + ' 导航悬浮（absolute）', m.dockPos === 'absolute', m.dockPos);
  if (name === 'PORT') {
    ok('PORT 输入条悬浮在 Dock 上方', m.compBottom <= m.dockTop + 4, 'comp=' + m.compBottom + ' dockTop=' + m.dockTop);
  } else {
    ok('LAND 输入条贴底悬浮', m.vh - m.compBottom < 30, 'bottom=' + m.compBottom);
  }
}
await browser.close();
console.log(fail === 0 ? 'CHATFIX-OK' : 'CHATFIX-FAIL x' + fail);
process.exit(fail === 0 ? 0 : 1);