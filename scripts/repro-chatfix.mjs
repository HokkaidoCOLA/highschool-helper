// 聊天页高度链守卫：drawer 必须保持 fixed 脱流，chatSplit 必须吃满 appMain（v3 错位事故防复发）
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
    const lgOn = document.documentElement.classList.contains('lg-on');
    const drawer = q('.drawer');
    const split = q('.chatSplit'), main = q('.appMain');
    const comp = q('.composer');
    return { lgOn, drawerPos: drawer ? getComputedStyle(drawer).position : 'none',
      splitH: Math.round(split.getBoundingClientRect().height), mainH: Math.round(main.getBoundingClientRect().height),
      compBottom: Math.round(comp.getBoundingClientRect().bottom), vh: innerHeight };
  });
  ok(name + ' 引擎已激活', m.lgOn);
  ok(name + ' drawer 保持 fixed 脱流', m.drawerPos === 'fixed', m.drawerPos);
  ok(name + ' chatSplit 吃满主区', m.splitH >= m.mainH - 24, m.splitH + '/' + m.mainH); // 横屏 appMain 有 6+14 既有 padding
  ok(name + ' composer 贴底', m.vh - m.compBottom < 90, 'vh=' + m.vh + ' bottom=' + m.compBottom);
}
await browser.close();
console.log(fail === 0 ? 'CHATFIX-OK' : 'CHATFIX-FAIL x' + fail);
process.exit(fail === 0 ? 0 : 1);