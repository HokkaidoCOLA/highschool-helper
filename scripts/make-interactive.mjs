// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 生成「高中助学 · 六科互动演示」单文件 HTML —— 随 PPT 一起放映用的活演示。
 *
 * PPT 是静态截图，讲不到「拖一下会转、按空格会走步骤」；这个文件把 App 同款引擎
 * （00/10/20/30 四个浏览器脚本，原样内联）+ normalizeScene + 六科演示场景打包进
 * 一个离线 HTML：双击即开，标签页切换学科，方向键/空格切步骤，3D 可拖拽旋转。
 *
 * 素材来源：~/.dsh/highschool-tutor/demos.json 里的 dm_0018…dm_0023（六科各一份）。
 * 用法：node scripts/make-interactive.mjs   → ~/Documents/演示/高中助学-互动演示.html
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(homedir(), 'Documents', '演示', '高中助学-互动演示.html')

/* ESM → 经典脚本：去 import 行、去 export 关键字 */
function demod(src, keep = []) {
  return src
    .split('\n')
    .filter((l) => !/^import\s/.test(l))
    .join('\n')
    .replace(/^export\s+(const|function|let)\b/gm, '$1')
}

const subjects = demod(readFileSync(resolve(ROOT, 'src/core/subjects.js'), 'utf8'))
const scene = demod(readFileSync(resolve(ROOT, 'src/core/scene.js'), 'utf8'))
const engine = ['00-core.browser.js', '10-scene2d.browser.js', '20-scene3d.browser.js', '30-shell.browser.js']
  .map((f) => readFileSync(resolve(ROOT, 'src/engine', f), 'utf8'))

/* 六科演示：数学=立体几何（dm_0024，3D 组），其余五科在 2D 组 */
const store = JSON.parse(readFileSync(resolve(homedir(), '.dsh/highschool-tutor/demos.json'), 'utf8'))
const WANT = ['dm_0019', 'dm_0020', 'dm_0021', 'dm_0022', 'dm_0023']
const SUBJECT_LABEL = { math: '数学', physics: '物理', chemistry: '化学', chinese: '语文', english: '英语', geography: '地理' }
const SUBJECT_COLOR = { math: '2F6DF6', physics: 'E08B1A', chemistry: '1FA97C', chinese: 'DC2626', english: '8B5CF6', geography: '0E8F86' }
const picked = []
for (const id of WANT) {
  const d = store.demos.find((x) => x.id === id)
  if (d) picked.push(d)
}
const scenes = picked.map((d) => ({
  group: '2D',
  id: d.id,
  subject: d.scene.subject || 'math',
  subjectLabel: SUBJECT_LABEL[d.scene.subject] || d.scene.subject || '综合',
  color: SUBJECT_COLOR[d.scene.subject] || '2F6DF6',
  title: d.scene.title || d.title,
  scene: d.scene,
}))

/* 3D 画廊：异面直线角 / 正方体截面 / 乙烯分子 / 地球光照 / NaCl 晶胞 */
const { EXAMPLES } = await import(resolve(ROOT, 'src/core/examples.js'))
const D3 = [
  { id: 'dm_0024', tag: '数学', note: '异面直线所成的角' },
  { id: 'dm_0001', tag: '数学', note: '正方体对角面' },
  { id: 'dm_0003', tag: '化学', note: '乙烯分子构型' },
  { id: 'dm_0004', tag: '地理', note: '夏至日光照' },
]
for (const t of D3) {
  const d = store.demos.find((x) => x.id === t.id)
  if (d && d.scene) scenes.push({ group: '3D', id: d.id, subject: d.scene.subject, subjectLabel: t.tag, color: SUBJECT_COLOR[d.scene.subject] || '2F6DF6', title: t.note, scene: d.scene })
}
{
  const ex = EXAMPLES.lattice3d
  if (ex) scenes.push({ group: '3D', id: 'ex-lattice', subject: 'chemistry', subjectLabel: '化学', color: SUBJECT_COLOR.chemistry, title: 'NaCl 晶胞', scene: { ...ex, title: 'NaCl 晶胞：微粒数与配位数' } })
}
/* 学科兜底：若某科在 2D/3D 两组都没出现，从 store 补一份 */
for (const key of Object.keys(SUBJECT_LABEL)) {
  if (!scenes.some((d) => d.subject === key)) {
    const alt = store.demos.find((d) => d.scene && d.scene.subject === key)
    if (alt) scenes.push({ group: (alt.scene.kind || '').endsWith('3d') ? '3D' : '2D', id: alt.id, subject: key, subjectLabel: SUBJECT_LABEL[key], color: SUBJECT_COLOR[key], title: alt.scene.title, scene: alt.scene })
  }
}
if (scenes.length !== 6) console.warn('⚠ 当前取到 ' + scenes.length + ' 科：', scenes.map((s) => s.subjectLabel).join('、'))

const html = `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>高中助学 · 六科互动演示</title>
<style>
  :root {
    --hst-fg: #171a21; --hst-fg2: #67707f; --hst-fg3: #9aa3b2; --hst-bg: #ffffff; --hst-bg2: rgba(38,49,72,.05);
    --hst-line: rgba(23,26,33,.10); --hst-brand: #5b7cfa; --hst-good: #17a35c; --hst-warn: #e8930c; --hst-bad: #e5484d;
  }
  @media (prefers-color-scheme: dark) {
    :root { --hst-fg: #e9ecf1; --hst-fg2: #9aa3b2; --hst-fg3: #6b7484; --hst-bg: #1a1d24; --hst-bg2: rgba(255,255,255,.06);
      --hst-line: rgba(255,255,255,.12); --hst-brand: #7d95ff; --hst-good: #46c47c; --hst-warn: #f0a93a; --hst-bad: #f26a6a; }
    body { background: #14161c; } .tabs button { background: #22262f; color: #cfd5df; } .brand h1 { color: #e9ecf1; } .brand p, .foot { color: #8b94a3; }
  }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f7f9fe; color: #171a21; min-height: 100vh; display: flex; flex-direction: column; }
  header { padding: 18px 26px 10px; display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; }
  .brand h1 { font-size: 19px; letter-spacing: .5px; }
  .brand p { font-size: 12px; color: #67707f; margin-top: 3px; }
  .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto; }
  .tabs button { appearance: none; border: 1px solid rgba(23,26,33,.10); border-radius: 999px; padding: 8px 14px 8px 8px; font-size: 13px; font-weight: 600; cursor: pointer; background: #fff; transition: transform .12s, box-shadow .12s; display: inline-flex; align-items: center; gap: 7px; }
  .tabs button i { font-style: normal; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; background: rgba(23,26,33,.08); color: #67707f; }
  .tabs button.on i { background: rgba(255,255,255,.28); color: #fff; }
  .tabs .sep { align-self: stretch; width: 1px; margin: 4px 4px; background: rgba(23,26,33,.14); }
  .tabs button:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(47,109,246,.18); }
  .tabs button.on { color: #fff; box-shadow: 0 6px 18px rgba(47,109,246,.30); }
  main { flex: 1; padding: 6px 26px 8px; display: flex; }
  #stageBox { flex: 1; background: #fff; border: 1px solid rgba(23,26,33,.08); border-radius: 16px; box-shadow: 0 10px 34px rgba(31,41,82,.08); overflow: hidden; display: flex; }
  #stageBox > div { flex: 1; min-height: 0; }
  .foot { padding: 10px 26px 16px; font-size: 12px; color: #67707f; display: flex; gap: 22px; flex-wrap: wrap; }
  .foot b { color: #2f6df6; }
</style>
</head><body>
<script>
/* 自诊断（ES5，任何古董内核都能跑）：老浏览器/IE 直接显示指引，不再白屏 */
(function () {
  var reason = null
  if (window.ActiveXObject || 'ActiveXObject' in window) reason = '当前是 IE 或「兼容模式」内核'
  else if (typeof globalThis === 'undefined') reason = '浏览器内核过旧（低于 Chrome 80）'
  else if (typeof Promise === 'undefined') reason = '浏览器不支持现代 JavaScript'
  if (!reason) {
    window.__hstFail = function (msg) {
      var d = document.createElement('div')
      d.style.cssText = 'position:fixed;left:8%;right:8%;top:12%;z-index:99;background:#fff3f3;border:2px solid #e5484d;border-radius:14px;padding:22px 26px;font:14px/1.7 sans-serif;color:#171a21'
      d.innerHTML = '<b style="font-size:17px;color:#e5484d">演示引擎加载失败</b><br>' + msg +
        '<br><span style="color:#67707f">请把这段文字拍照反馈；或改用 Edge/Chrome 极速模式打开本文件。</span>'
      ;(document.body || document.documentElement).appendChild(d)
    }
    window.onerror = function (m, s, l) { if (!window.__hstBooted) window.__hstFail('脚本错误：' + m + '（第 ' + l + ' 行）') }
    return
  }
  document.documentElement.innerHTML =
    '<head><meta charset="utf-8"><title>请更换浏览器打开</title></head>' +
    '<body style="margin:0;background:#f7f9fe;font-family:Microsoft YaHei,PingFang SC,sans-serif">' +
    '<div style="max-width:640px;margin:12vh auto 0;background:#fff;border:1px solid #e3e9f5;border-radius:18px;padding:38px 42px;box-shadow:0 10px 34px rgba(31,41,82,.08)">' +
    '<div style="font-size:34px"></div>' +
    '<h1 style="font-size:22px;margin:10px 0 6px;color:#171a21">这个浏览器跑不动互动演示</h1>' +
    '<p style="color:#e5484d;font-weight:700;margin:0 0 14px">' + reason + '</p>' +
    '<p style="color:#5a6270;line-height:1.9;margin:0 0 10px">请任选一种办法：</p>' +
    '<ol style="color:#171a21;line-height:2.1;padding-left:22px;margin:0">' +
    '<li>用 <b>Microsoft Edge</b> 打开：开始菜单搜「Edge」→ 把这个文件拖进 Edge 窗口</li>' +
    '<li>360/QQ 浏览器：点地址栏右侧的闪电⚡图标，切换到<b>极速模式</b>后刷新</li>' +
    '<li>把文件复制到桌面后，右键 → 打开方式 → Edge / Chrome</li></ol>' +
    '<p style="color:#9aa3b2;font-size:12px;margin:18px 0 0">高中助学 · 六科互动演示 · 需要 Chrome 80+ / Edge 80+ / Firefox 72+ 内核</p>' +
    '</div></body>'
})()
</script>
<header>
  <div class="brand"><h1>高中助学 · 六科互动演示</h1><p>与 App 同款渲染引擎 · 离线单文件 · 数据不联网</p></div>
  <nav class="tabs" id="tabs"></nav>
</header>
<main><div id="stageBox"></div></main>
<div class="foot">
  <span><b>空格 / ← →</b> 切换讲解步骤</span><span><b>R</b> 复位画布</span><span><b>3D 场景</b> 按住拖动旋转 · 滚轮缩放</span><span><b>2D 画布</b> 拖动平移 · 滚轮缩放</span>
  <span style="margin-left:auto">GPL-3.0-or-later · 生成于 ${new Date().toISOString().slice(0, 10)}</span>
</div>
<script>${engine[0]}<\/script>
<script>${engine[1]}<\/script>
<script>${engine[2]}<\/script>
<script>${engine[3]}<\/script>
<script>${subjects}\n<\/script>
<script>${scene}\nglobalThis.__HST_SCENE__ = { normalizeScene }<\/script>
<script>
try {
const SCENES = ${JSON.stringify(scenes)}
const NS = globalThis.__HST__
window.__hstBooted = true
const st = document.createElement('style'); st.textContent = NS.CSS; document.head.appendChild(st)
const box = document.getElementById('stageBox')
const root = document.createElement('div'); root.id = 'hst-root'; box.appendChild(root)
const player = new NS.Player(root, { mode: 'panel', token: 'hst-standalone' })
const tabs = document.getElementById('tabs')
let cur = -1
function go(i) {
  if (i === cur) return
  cur = i
  const d = SCENES[i]
  const norm = globalThis.__HST_SCENE__.normalizeScene(d.scene)
  player.load(norm.scene)
  requestAnimationFrame(() => { player.layout(); player.render() })
  tabs.querySelectorAll('button').forEach((b) => { const on = +b.dataset.i === i; b.classList.toggle('on', on); b.style.background = on ? '#' + SCENES[+b.dataset.i].color : '' })
}
SCENES.forEach((d, i) => {
  if (i > 0 && SCENES[i].group !== SCENES[i - 1].group) { const sp = document.createElement('span'); sp.className = 'sep'; tabs.appendChild(sp) }
  const b = document.createElement('button')
  b.innerHTML = '<i></i><span></span>'
  b.children[0].textContent = d.group
  b.children[1].textContent = d.subjectLabel + ' · ' + d.title
  b.dataset.i = i
  b.onclick = () => go(i)
  tabs.appendChild(b)
})
go(0)
} catch (e) {
  if (window.__hstFail) window.__hstFail('初始化异常：' + (e && e.message ? e.message : e))
}
<\/script>
</body></html>`

writeFileSync(OUT, html)
console.log('互动演示 →', OUT, '(' + Math.round(html.length / 1024) + ' KB · ' + scenes.length + ' 科)')
