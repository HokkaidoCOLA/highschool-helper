import './ui-stub.mjs'
import React from 'react'
import { renderToStaticMarkup as rs } from 'react-dom/server'
import { store } from '../src/state.js'
import { seedItems } from '../src/core/seed.js'
import Today from '../src/ui/Today.jsx'
import Review from '../src/ui/Review.jsx'
import Library from '../src/ui/Library.jsx'
import Demos from '../src/ui/Demos.jsx'
import Docs from '../src/ui/Docs.jsx'
import Stats from '../src/ui/Stats.jsx'
import Settings from '../src/ui/Settings.jsx'
import App from '../src/ui/App.jsx'

let passed = 0
const failures = []
function ok(label, cond, extra) {
  if (cond) { passed += 1; console.log('  ✓ ' + label) }
  else { failures.push(label); console.error('  ✗ ' + label + (extra ? ' → ' + extra : '')) }
}

await store.load()
store.saveProfile({ grade: 'g2', dailyReviewTarget: 40 })
store.upsertItems(seedItems())
store.upsertItems([{ subject: 'math', kind: 'mistake', topic: '一元函数的导数及其应用', question: '求 f(x)=x^3-3x 极小值', answer: 'f(1)=-2', explanation: '先求导找驻点', source: '自测', tags: ['计算失误'] }])
store.review(store.queue({ limit: 3, includeNew: true }).items.map((it, i) => ({ id: it.id, grade: ['good', 'again', 'hard'][i % 3] })))
store.logStudy({ subject: 'math', minutes: 45, note: '导数含参不熟' })
store.logStudy({ subject: 'physics', chapter: '抛体运动', status: 'done' })
store.saveExam({ name: '期中', scores: [{ subject: 'math', score: 128 }, { subject: 'chinese', score: 112 }] })
const { EXAMPLES } = await import('../src/core/examples.js')
const { normalizeScene, sceneSummary, keySteps } = await import('../src/core/scene.js')
const s = normalizeScene(EXAMPLES.plot2d)
store.saveDemo({ title: s.scene.title, kind: 'plot2d', subject: 'math', topic: s.scene.topic, summary: sceneSummary(s.scene), keySteps: keySteps(s.scene), scene: s.scene })

const checks = [
  ['今日页', <Today goReview={() => {}} />, '距高考'],
  ['今日页·倒计时数字', <Today goReview={() => {}} />, '天 · 距高考（'],
  ['复习页（有卡）', <Review onChangeSubject={() => {}} />, '显示答案'],
  ['题库页', <Library />, '内置卡片包'],
  ['演示页', <Demos />, '九种场景类型样例'],
  ['资料页', <Docs />, '选择文件'],
  ['统计页', <Stats />, '记忆保持力'],
  ['统计页·模考', <Stats />, '总分'],
  ['设置页', <Settings />, '数据与迁移'],
  ['设置页·章节进度', <Settings />, '教材章节进度'],
  ['App 外壳', <App />, '高中助学'],
]
for (const [label, node, needle] of checks) {
  try {
    const html = rs(node)
    ok(label, html.includes(needle), '渲染成功但缺关键字「' + needle + '」')
  } catch (err) {
    ok(label, false, String(err && err.message ? err.message : err).slice(0, 120))
  }
}
console.log('')
if (failures.length > 0) { console.error('UI 冒烟失败 ' + failures.length + ' 项'); process.exit(1) }
else console.log('✅ UI 冒烟通过 ' + passed + ' 项')