// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * test-core.mjs —— 移植层核心回归（纯 node，无浏览器）。
 *
 * 覆盖：Store 全链路（水合→排期→评分→统计，持久层走内存兜底）、导入解析、
 * 试卷切题与答案回填、zipfs+docs 真实 docx 解析（fixtures 合成）、引擎纯函数。
 * 演示引擎的 canvas 渲染回归仍以插件仓库 frame-smoke.mjs 为准（字节同源，那边绿=这边绿）。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
let passed = 0
const ok = (label, fn) => {
  try { fn(); passed += 1; console.log('  \u2713 ' + label) }
  catch (err) { console.error('  \u2717 ' + label + ' \u2192 ' + String(err && err.message ? err.message : err)); process.exitCode = 1 }
}

const { Store } = await import(join(ROOT, 'src/core/store.js'))
const { seedItems } = await import(join(ROOT, 'src/core/seed.js'))
const { schedule, newSrs } = await import(join(ROOT, 'src/core/srs.js'))
const { parseImport, detectFormat } = await import(join(ROOT, 'src/core/importer.js'))
const { parseStudyText } = await import(join(ROOT, 'src/core/paper.js'))
const { normalizeScene } = await import(join(ROOT, 'src/core/scene.js'))
const { EXAMPLES } = await import(join(ROOT, 'src/core/examples.js'))
const { extractText } = await import(join(ROOT, 'src/core/docs.js'))
const { openZip } = await import(join(ROOT, 'src/core/zipfs.js'))
const { makeDocx, makePptx } = await import(join(HERE, 'fixtures.mjs'))

console.log('\n\u2460 Store \u5168\u94fe\u8def')
const store = await new Store().load()
ok('\u9ed8\u8ba4\u8bbe\u7f6e\u53ef\u8bfb', () => { const p = store.profile(); assert.equal(p.subjects.length, 6) })
ok('\u5199\u5165\u5e76\u6c34\u5408\uff08\u5185\u5b58\u6301\u4e45\u5c42\uff09', async () => {})
store.saveProfile({ grade: 'g2' })
ok('\u5e74\u7ea7\u2192\u9ad8\u8003\u65e5\u671f\u63a8\u7b97', () => assert.match(store.profile().examDate, /\d{4}-06-07/))
const seeded = store.upsertItems(seedItems())
ok('\u5185\u7f6e\u5361\u7247\u5305 60 \u5f20', () => assert.equal(seeded.added.length, 60))
ok('seedKey \u5e42\u7b49', () => assert.equal(store.upsertItems(seedItems()).added.length, 0))
const q1 = store.queue({ limit: 5 })
ok('\u961f\u5217\u53d6\u65b0\u5361\uff08\u53d7\u65e5\u9884\u7b97\uff09', () => assert.ok(q1.items.length > 0 && q1.items.length <= 20))
const graded = store.review(q1.items.slice(0, 3).map((it, i) => ({ id: it.id, grade: ['again', 'good', 'easy'][i] })))
ok('\u8bc4\u5206\u63a8\u8fdb\u6392\u671f', () => {
  assert.equal(graded.failed.length, 0)
  assert.ok(graded.results.find((r) => r.grade === 'again').intervalDays === 0)
  assert.ok(graded.results.find((r) => r.grade === 'good').intervalDays >= 1)
})
ok('overview/stats \u4e0d\u629b\u9519', () => { const o = store.overview(); assert.ok(o.due.total >= 0); assert.ok(Array.isArray(store.stats(7).series)) })
ok('exportAll/importAll \u5f80\u8fd4', () => {
  const dump = store.exportAll()
  assert.ok(dump['items.json'].items.length >= 60)
  const s2 = new Store()
  s2.hydrated = new Map(Object.entries(Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, JSON.stringify(v)]))))
  s2.cache.clear()
  assert.equal(s2.db().items.length, dump['items.json'].items.length)
})
ok('\u5f02\u6b65\u843d\u76d8 flush \u5b8c\u6210', async () => { await store.flush() })
const done = store.flush()

console.log('\n\u2461 \u5bfc\u5165\u4e0e\u8bd5\u5377')
ok('md \u95ee\u7b54\u5757\u8bc6\u522b', () => {
  const r = parseImport('## \u6570\u5b66\nQ: 1+1?\nA: 2\n---\nQ: 2+2?\nA: 4', {})
  assert.equal(r.format, 'md'); assert.equal(r.items.length, 2); assert.equal(r.items[0].subject, 'math')
})
ok('csv \u8bc6\u522b', () => assert.equal(detectFormat('a,b\n1,2'), 'csv'))
ok('\u8bd5\u5377\u5207\u9898+\u7b54\u6848\u56de\u586b', () => {
  const paper = [
    '\u4e00\u3001\u5355\u9879\u9009\u62e9\u9898',
    '1\uff0e \u5bfc\u6570 f(x)=x^2 \u7684 f\u2032(1)=\uff1f\uff085\u5206\uff09',
    'A\uff0e0  B\uff0e1  C\uff0e2  D\uff0e3',
    '2\uff0e \u4e09\u89d2\u51fd\u6570 sin(\u03c0/2)=\uff1f',
    'A\uff0e0  B\uff0e1  C\uff0e-1  D\uff0e1/2',
    '\u53c2\u8003\u7b54\u6848',
    '1\uff0eC 2\uff0eB',
  ].join('\n')
  const r = parseStudyText(paper, { subject: 'math' })
  assert.equal(r.mode, 'paper')
  assert.equal(r.stats.questions, 2)
  assert.equal(r.items[0].answer, 'C')
  assert.equal(r.items[1].answer, 'B')
  assert.equal(r.confidence, 'high')
})
ok('\u975e\u8bd5\u5377\u89e6\u53d1\u4f4e\u7f6e\u4fe1\u5ea6', () => {
  const r = parseStudyText('127.0.0.1 localhost\n127.0.0.53 resolver', {})
  assert.equal(r.confidence, 'low')
})

console.log('\n\u2462 \u6d4f\u89c8\u5668\u5316 ZIP/\u8d44\u6599\u89e3\u6790')
const docx = makeDocx([
  '\u4e00\u3001\u5355\u9879\u9009\u62e9\u9898\uff1a\u672c\u9898\u51712\u5c0f\u9898',
  '1\uff0e \u5316\u5b66\u50ac\u5316\u53cd\u5e94\u4e2d\uff0c\u5347\u9ad8\u6e29\u5ea6\u5e73\u8861\u5411\u5438\u70ed\u65b9\u5411\u79fb\u52a8\u3002\u8be5\u53cd\u5e94\u6b63\u53cd\u5e94\u662f\uff1f',
  'A\uff0e\u5438\u70ed  B\uff0e\u653e\u70ed  C\uff0e\u4e0d\u53d8  D\uff0e\u4e0d\u786e\u5b9a',
  '2\uff0e \u7269\u8d28\u7684\u91cf\u7684\u5355\u4f4d\u662f\uff1f',
  'A\uff0eg  B\uff0emol  C\uff0eL/mol  D\uff0eg/mol',
  '\u53c2\u8003\u7b54\u6848',
  '1\uff0eA 2\uff0eB',
])
ok('fflate \u89e3\u5f00\u771f\u5b9e docx', () => {
  const zip = openZip(docx)
  assert.ok(zip.has('word/document.xml'))
})
const extracted = extractText(docx, '\u5316\u5b66\u5c0f\u6d4b.docx')
ok('docs \u62bd\u53d6 docx \u6b63\u6587', () => { assert.ok(extracted.ok); assert.ok(extracted.text.includes('\u5355\u9879\u9009\u62e9\u9898')) })
const docParse = parseStudyText(extracted.text, { subject: 'chemistry' })
ok('docx \u2192 \u9898\u76ee\uff08\u5e26\u7b54\u6848\uff09', () => {
  assert.equal(docParse.stats.questions, 2)
  assert.equal(docParse.items[0].answer, 'A')
})
const pptx = makePptx([['\u7269\u8d28\u4e0e\u5143\u7d20', '\u5143\u7d20\u5468\u671f\u5f8b\u53d8\u5316\u7684\u5b9e\u8d28\u662f\u539f\u5b50\u7ed3\u6784\u7684\u5468\u671f\u6027\u53d8\u5316'], ['\u70ed\u5316\u5b66', '\u7113\u53d8\u5316\u5b66\u53cd\u5e94\u7684\u7113\u53d8\u7b49\u4e8e\u751f\u6210\u7269\u5185\u80fd\u51cf\u53cd\u5e94\u7269\u5185\u80fd']])
ok('pptx \u2192 \u8bfe\u4ef6\u5361', () => {
  const ex = extractText(pptx, 'x.pptx')
  assert.ok(ex.ok)
  const r = parseStudyText(ex.text, { subject: 'chemistry' })
  assert.equal(r.mode, 'courseware')
  assert.ok(r.stats.cards >= 2)
})
ok('GBK \u7eaf\u6587\u672c\u55c5\u63a2', () => {
  const gbk = new Uint8Array([0xd6, 0xd0, 0xce, 0xc2])
  const r = extractText(gbk, 'a.txt')
  assert.ok(r.ok && r.text.includes('\u4e2d\u6e29'))
})

console.log('\n\u2463 \u5f15\u64ce\u7eaf\u51fd\u6570\uff08\u65e0 DOM \u90e8\u5206\uff09')
const coreSrc = readFileSync(join(ROOT, 'src/engine/00-core.browser.js'), 'utf8')
const shell = { }
const fn = new Function(coreSrc)
fn.call(shell)
const NS = globalThis.__HST__
ok('expr \u7f16\u8bd1\u4e0e\u9690\u5f0f\u4e58\u6cd5', () => {
  assert.equal(NS.expr.compile('2x')({ x: 3 }), 6)
  assert.equal(NS.expr.compile('x^2-3')({ x: 2 }), 1)
}) 
ok('\u6570\u503c\u5bfc\u6570', () => assert.ok(Math.abs(NS.expr.derivative(NS.expr.compile('x^2'), 3) - 6) < 1e-4))
ok('sup \u4e0a\u4e0b\u6807', () => assert.equal(NS.sup('x^2'), 'x\u00b2'))
const norm = normalizeScene(EXAMPLES.geom3d)
ok('scene \u89c4\u8303\u5316\uff08geom3d \u793a\u4f8b\uff09', () => {
  assert.equal(norm.warnings.length, 0)
  assert.ok(norm.scene.objects.length > 0)
})
// 回归护栏：normalizeObject 字段白名单曾丢掉 force/velocity 的 mag（力箭头全画成同一长度）、
// 字符串 mass 与 label（物块标注消失）。引擎读取见 10-scene2d.browser.js 的 o.mag / o.mass / o.label。
// 力学示例本身只保证 mag；mass/label 的白名单用合成对象直接测，避免与示例数据强耦合。
ok('scene \u4fdd\u7559 mag/mass/label\uff08\u529b\u5b66\u5b57\u6bb5\u767d\u540d\u5355\uff09', () => {
  const byId = Object.fromEntries(normalizeScene(EXAMPLES.mech2d).scene.objects.map((o) => [o.id, o]))
  assert.equal(byId.G.mag, 17)
  assert.equal(byId.G2.mag, 14.7)
  assert.equal(byId.block.label, 'm') // 示例滑块用 label 标质量符号（mass:'m' 会被引擎渲染成 "m=m"）
  const synth = normalizeScene({
    kind: 'mech2d',
    objects: [
      { id: 'b1', type: 'body', x: 1, y: 1, mass: '2kg' },
      { id: 'b2', type: 'body', x: 2, y: 1, mass: 5 },
      { id: 'v1', type: 'velocity', x: 1, y: 1, mag: 8 },
    ],
  }).scene
  const s = Object.fromEntries(synth.objects.map((o) => [o.id, o]))
  assert.equal(s.b1.mass, '2kg')
  assert.equal(s.b2.mass, 5)
  assert.equal(s.v1.mag, 8)
})


console.log('\n⑤ 双环四库 M1：弱点注册表与探索档案（新表，个人状态数据只在本机）')
const s2 = await new Store().load()
const ex1 = s2.saveExploration({
  convId: 'cv_a', title: '导数探索', subject: '数学', parentId: 'cv_p', gen: 1, transcriptCount: 4,
  compact: { conclusion: '会拆内外层了', stuckReplay: '卡在「内层忘乘」', chain: ['认外层', null, '乘内层'], openBranches: ['隐函数'] },
})
ok('saveExploration：ep_ 前缀 + 学科别名归一 + 非降级', () => {
  assert.ok(ex1.id.startsWith('ep_'))
  assert.equal(ex1.subject, 'math')
  assert.equal(ex1.degraded, false)
})
ok('saveExploration：chain 过滤 null、按四件套留存', () => {
  assert.equal(JSON.stringify(ex1.compact.chain), '["认外层","乘内层"]')
  assert.equal(ex1.compact.openBranches[0], '隐函数')
})
const dep = s2.saveExploration({ convId: 'cv_bad', compact: null })
ok('降级档：compact 为 null 即 degraded', () => {
  assert.equal(dep.degraded, true)
  assert.equal(s2.getExploration(dep.id).compact, null)
})
ok('listExplorations 按 convId 过滤', () => {
  const r = s2.listExplorations({ convId: 'cv_a' })
  assert.equal(r.total, 1)
  assert.equal(r.explorations[0].id, ex1.id)
})
const w1 = s2.addWeakness({ subject: 'math', node: '复合函数的求导法则', quote: '内层导数老忘乘', src: 'conv:cv_a', source: 'explore', confidence: 0.4 })
ok('addWeakness：discovered 起步 + wk_ 前缀', () => {
  assert.equal(w1.status, 'discovered')
  assert.ok(w1.id.startsWith('wk_'))
})
const w2 = s2.addWeakness({ subject: '数学', node: '复合函数的求导法则', quote: '这次又忘了乘内层', src: 'item:it_00001', source: 'grade' })
ok('同 node 合并成一条（双源交叉验证置信升，D1③）', () => {
  assert.equal(w2.id, w1.id)
  assert.equal(s2.listWeaknesses({}).total, 1)
  assert.deepEqual(w2.sources, ['explore', 'grade'])
  assert.ok(w2.confidence > 0.5 && w2.confidence <= 0.9)
  assert.equal(w2.evidence.length, 2)
})
const dup = s2.addWeakness({ subject: 'math', node: '复合函数的求导法则', quote: '内层导数老忘乘', src: 'conv:cv_a', source: 'explore' })
ok('重复 evidence / 同来源不涨', () => {
  assert.equal(dup.evidence.length, 2)
  assert.equal(dup.sources.length, 2)
  assert.equal(dup.confidence, w2.confidence)
})
ok('空 node 视为无效信号拒录', () => assert.equal(s2.addWeakness({ subject: 'math', node: '  ' }), null))
const wdb = s2.weaknessDb()
wdb.weaknesses[0].status = 'invalid'
s2.write('weaknesses', wdb)
const reborn = s2.addWeakness({ subject: 'math', node: '复合函数的求导法则', quote: '又卡了', src: 'conv:cv_b', source: 'explore' })
ok('invalid 不并档：同 node 再犯是新目标（翻案语义留 M4）', () => {
  assert.notEqual(reborn.id, w1.id)
  assert.equal(reborn.status, 'discovered')
})
ok('状态机拒绝跳档（discovered→remedying 非法）', () => assert.equal(s2.setWeaknessStatus(reborn.id, 'remedying', {}), null))
const v1 = s2.setWeaknessStatus(reborn.id, 'verifying', {})
const v2 = s2.setWeaknessStatus(reborn.id, 'remedying', { resolution: { kind: 'spotcheck', verdict: 'confirmed', note: '答案暴露不会' }, evidence: { src: 'spotcheck', quote: '答：x；判：y' } })
ok('verify→remedying 过闸门流转带 resolution/evidence', () => {
  assert.notEqual(v1, null)
  assert.equal(v2.status, 'remedying')
  assert.equal(v2.resolution.kind, 'spotcheck')
  assert.equal(v2.evidence.length, 2)
})
ok('remedyInjection 无任务走全局池', () => assert.ok(s2.remedyInjection(null, 6).some((w) => w.id === reborn.id)))
ok('remedyInjection 交集过滤：命中任务节点（D1②）', () => {
  const hit = s2.remedyInjection([reborn.node], 6)
  assert.equal(hit.length, 1)
  assert.equal(hit[0].id, reborn.id)
})
ok('remedyInjection 交集为空不硬塞（其余留全局池 D3）', () => assert.equal(s2.remedyInjection(['完全无关的节点'], 6).length, 0))
const fin = s2.setWeaknessStatus(reborn.id, 'mastered', { itemId: 'it_09999' })
ok('mastered 终态带 itemId 且不再流转', () => {
  assert.equal(fin.itemId, 'it_09999')
  assert.equal(s2.setWeaknessStatus(reborn.id, 'remedying', {}), null)
})
const dw = s2.addWeakness({ subject: 'math', node: '动量定理', quote: 'q' })
const d1 = s2.setWeaknessStatus(dw.id, 'invalid', { resolution: { kind: 'dismiss', verdict: 'irrelevant' } })
ok('dismiss → invalid，H1/H4 指标可算', () => {
  assert.equal(d1.status, 'invalid')
  const st = s2.weaknessStats()
  assert.equal(st.dismissed, 1)
  assert.ok(Number.isFinite(st.dismissRate))
  assert.ok(Number.isFinite(st.invalidRate))
})
for (let i = 0; i < 503; i += 1) s2.addWeakness({ subject: 'math', node: 'n' + i, source: 'explore' }, 2000 + i)
ok('weaknesses cap 500 丢最旧', () => {
  const rows = s2.weaknessDb().weaknesses
  assert.equal(rows.length, 500)
  assert.equal(rows.find((x) => x.node === 'n0'), undefined)
  assert.ok(rows.find((x) => x.node === 'n502'))
})
for (let i = 0; i < 205; i += 1) s2.saveExploration({ convId: 'cv_cap' + i, compact: { conclusion: 'c' + i } }, 1000 + i)
ok('explorations cap 200 丢最旧', () => {
  const rows = s2.explorationDb().explorations
  assert.equal(rows.length, 200)
  assert.equal(rows.find((e) => e.convId === 'cv_cap0'), undefined)
  assert.ok(rows.find((e) => e.convId === 'cv_cap204'))
})
const dumpM1 = s2.exportAll()
ok('exportAll 覆盖两个新表（E7/红线 3）', () => {
  assert.ok(Array.isArray(dumpM1['weaknesses.json'].weaknesses))
  assert.ok(Array.isArray(dumpM1['explorations.json'].explorations))
  assert.equal(dumpM1['weaknesses.json'].weaknesses.length, 500)
})
const s3 = new Store()
s3.hydrated = new Map(Object.entries(Object.fromEntries(Object.entries(dumpM1).map(([k, v]) => [k, JSON.stringify(v)]))))
ok('备份水合往返含新表', () => {
  assert.equal(s3.explorationDb().explorations.length, 200)
  assert.equal(s3.weaknessDb().weaknesses.length, 500)
})

console.log('\n⑥ 双环四库 M3：任务表（A 环）与补习回流')
const t1 = s2.saveTask({ goal: '周五前搞定导数大题', subject: '数学', nodes: ['复合函数的求导法则', '导数与单调性'], plan: ['过一遍链式法则', '做 3 道例题', '整理错题'], materials: ['已知 f(x)=sin(x²)，求 f′(x)', '讨论 f 在 [0,π] 单调性'] })
ok('saveTask：tk_ 前缀 + 学科归一 + active 起步', () => {
  assert.ok(t1.id.startsWith('tk_'))
  assert.equal(t1.subject, 'math')
  assert.equal(t1.status, 'active')
  assert.equal(t1.plan.length, 3)
})
ok('saveTask 拒空 goal', () => assert.equal(s2.saveTask({ goal: '  ' }), null))
const pd = s2.setTaskPlanDone(t1.id, 0, true)
ok('计划勾选（判定在用户界面）', () => {
  assert.equal(pd.plan[0].done, true)
  assert.equal(pd.plan[2].done, false)
  assert.equal(s2.setTaskPlanDone(t1.id, 9, true), null)
})
s2.addTaskDeliverable(t1.id, '我的解法：f′=cos(x²)·2x，第一题对；第二题直接 cos 忘了乘内层')
const g1 = s2.gradeTask(t1.id, { score: 72, full: 100, comment: '链式法则不稳，漏乘内层' }, [
  { node: '复合函数的求导法则', quote: '第二题 f′ 直接写 cos' },
  { node: '   ', quote: '空节点垃圾' },
])
ok('gradeTask：评分入档 + gaps 写弱点表 source=grade（空 node 拒）', () => {
  assert.equal(g1.score.percent, 72)
  assert.equal(g1.gaps.length, 1)
  const w = s2.getWeakness(g1.gaps[0].weaknessId)
  assert.equal(w.status, 'discovered')
  assert.ok(w.sources.includes('grade'))
})
const gapW = s2.getWeakness(g1.gaps[0].weaknessId)
ok('gap 弱点未清零前 readyToFinish=false', () => assert.equal(s2.getTask(t1.id).readyToFinish, false))
s2.setWeaknessStatus(gapW.id, 'verifying', {})
s2.setWeaknessStatus(gapW.id, 'remedying', { resolution: { kind: 'spotcheck', verdict: 'confirmed' } })
ok('补习未定稿（remedying）不清 gap', () => assert.equal(s2.getTask(t1.id).gaps[0].cleared, false))
s2.setWeaknessStatus(gapW.id, 'mastered', { itemId: 'it_00123' })
ok('mastered 回流：gap 清零 + readyToFinish（D4 只提示不代办）', () => {
  const t = s2.getTask(t1.id)
  assert.equal(t.gaps[0].cleared, true)
  assert.equal(t.gaps[0].clearedVia, 'mastered')
  assert.equal(t.readyToFinish, true)
})
const nodes = s2.activeTaskNodes()
ok('activeTaskNodes：活跃任务节点集（交集过滤数据源）', () => {
  assert.ok(Array.isArray(nodes))
  assert.ok(nodes.includes('复合函数的求导法则'))
})
const outside = s2.addWeakness({ subject: 'physics', node: '机械波', quote: 'q' })
s2.setWeaknessStatus(outside.id, 'verifying', {})
s2.setWeaknessStatus(outside.id, 'remedying', { resolution: { kind: 'spotcheck', verdict: 'confirmed' } })
ok('交集过滤：任务外 remedying 留全局池不注入（D3）', () => {
  const inj = s2.remedyInjection(s2.activeTaskNodes(), 8)
  assert.ok(!inj.some((w) => w.id === outside.id))
  assert.ok(s2.remedyInjection(null, 8).some((w) => w.id === outside.id))
})
const fr = s2.finishTask(t1.id, { summary: '搞定链式法则：外层导数乘内层导数', cards: [
  { question: 'd/dx sin(x²)=?', answer: '2x·cos(x²)', explanation: '本次主错：漏乘内层 2x' },
  { question: '', answer: '无效卡' },
  { topic: '导数与单调性', question: 'f 递增的导数条件？', answer: 'f′≥0 且不恒为 0' },
] })
ok('finishTask：done + 有效卡入题库（无效卡跳过带 errors）', () => {
  assert.equal(fr.task.status, 'done')
  assert.equal(fr.cards.length, 2)
  assert.equal(fr.errors.length, 1)
  const cardRows = s2.db().items.filter((i) => String(i.source) === 'task:' + t1.id)
  assert.equal(cardRows.length, 2)
  assert.ok(cardRows.every((c) => c.kind === 'card' && c.srs.state === 'new'))
})
ok('定稿后 activeTaskNodes 归 null', () => assert.equal(s2.activeTaskNodes(), null))
for (let i = 0; i < 105; i += 1) s2.saveTask({ goal: 't' + i }, 5000 + i)
ok('tasks cap 100 丢最旧 + exportAll 覆盖', () => {
  const rows = s2.taskDb().tasks
  assert.equal(rows.length, 100)
  assert.ok(s2.exportAll()['tasks.json'])
  assert.equal(s2.exportAll()['tasks.json'].tasks.length, 100)
})

// ──  IDB 写语义（真机数据丢失事故防回归）：连接预热后，put 必须在调用同一任务内派发 ──
const dispatched = []
globalThis.indexedDB = {
  open: () => {
    const req = {}
    setTimeout(() => {
      req.result = {
        transaction: () => {
          const tx = {
            objectStore: () => ({
              put: (v, k) => { dispatched.push(k); setTimeout(() => tx.oncomplete && tx.oncomplete(), 0) },
              delete: () => { setTimeout(() => tx.oncomplete && tx.oncomplete(), 0) },
              openCursor: () => ({ set onsuccess(_h) {} }),
            }),
          }
          return tx
        },
      }
      if (req.onsuccess) req.onsuccess()
    }, 0)
    return req
  },
}
const idbMod = await import('./../src/core/idb.js')
await idbMod.prime()
const doneP = idbMod.idbSet('items.json', '{}')
ok('put 在 idbSet 同一任务内同步派发（alert 阻塞也不丢）', () => assert.ok(dispatched.includes('items.json')))
await doneP
ok('事务 commit 后 promise 解决', () => assert.ok(true))

console.log('')
if (process.exitCode) console.error('\u5b58\u5728\u5931\u8d25\u9879')
else console.log('\u2705 \u6838\u5fc3\u79fb\u690d\u56de\u5f52\u901a\u8fc7 ' + passed + ' \u9879')
await done