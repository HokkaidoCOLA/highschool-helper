import { toast } from './shared.jsx'
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 资料页：Word 试卷 / PPT 课件 / 文本 → 切题与答案回填 → 预览勾选 → 入库（对应插件「资料」标签 + tutor_paper_import）。
 * PDF/图片明确不做半吊子解析：给替代路径（转 docx / 拍照后手录）。
 */
import React from 'react'
import { store, notify } from '../state.js'
import { extractText } from '../core/docs.js'
import { parseStudyText } from '../core/paper.js'
import { SUBJECTS, subjectLabel, toSubject } from '../core/subjects.js'

export default function Docs() {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [parsed, setParsed] = React.useState(null)
  const [text, setText] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [topic, setTopic] = React.useState('')
  const [source, setSource] = React.useState('')
  const [checked, setChecked] = React.useState({})
  const [sure, setSure] = React.useState(false)

  const show = (items, extra) => {
    setParsed({ ...extra, items })
    const on = {}
    items.forEach((it, i) => { on[i] = true })
    setChecked(on)
  }

  const onFile = async (fileList) => {
    const file = fileList && fileList[0]
    if (!file) return
    setBusy(true); setError(''); setParsed(null)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const extracted = extractText(buf, file.name)
      if (!extracted.ok) { setError(extracted.label + ' 不能直接解析：' + (extracted.hint || '')); return }
      const p = parseStudyText(extracted.text, { subject: toSubject(subject) || undefined, topic: topic || undefined, source: source || file.name.replace(/\.[a-z0-9]+$/i, '') })
      show(p.items, { ...p, warnings: extracted.warnings.concat(p.warnings || []), label: extracted.label })
    } catch (err) {
      setError('解析失败：' + String(err && err.message ? err.message : err))
    } finally { setBusy(false) }
  }

  const onPaste = () => {
    setParsed(null); setError('')
    if (text.trim() === '') return
    const p = parseStudyText(text, { subject: toSubject(subject) || undefined, topic: topic || undefined, source: source || '粘贴文本' })
    show(p.items, { ...p, warnings: p.warnings || [], label: '粘贴文本' })
  }

  const doImport = () => {
    if (parsed === null) return
    if (parsed.confidence === 'low' && !sure) return
    const picked = parsed.items.filter((_, i) => checked[i])
    const list = picked.map((it) => ({ subject: it.subject, kind: it.kind, topic: it.topic, question: it.question, answer: it.answer, explanation: it.explanation, tags: it.tags, difficulty: it.difficulty, source: it.source, grade: it.grade }))
    const r = store.upsertItems(list)
    notify()
    toast('入库完成：新增 ' + r.added.length + ' 条、跳过 ' + r.skipped + ' 条，已按艾宾浩斯自动排期。')
    setParsed(null); setText('')
  }

  const low = parsed !== null && parsed.confidence === 'low'
  return (
    <div>
      <div className="card">
        <h3>选择文件（docx / pptx / txt / md / csv / html）</h3>
        <input type="file" accept=".docx,.pptx,.txt,.md,.markdown,.csv,.html,.htm" onChange={(e) => onFile(e.target.files)} />
        <p className="hint">PDF 请先用 Word/WPS 另存为 .docx；拍的题/扫描件请在电脑上让 AI 读图后手工录入（App 二期会接识图）。</p>
        <div className="row">
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">学科：自动识别</option>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          <input className="input grow" placeholder="统一知识点（可空）" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="row">
          <input className="input grow" placeholder="来源标注（默认取文件名）" value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
      </div>
      <div className="card">
        <h3>或直接粘贴文本</h3>
        <textarea className="input tall2" placeholder="粘贴一份带「1．… A．…」「参考答案 1．B 2．A」排版的试卷文本" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" className="btn" onClick={onPaste}>解析文本</button>
      </div>
      {busy ? <p className="hint">解析中…</p> : null}
      {error !== '' ? <div className="card err">{error}</div> : null}
      {parsed !== null ? (
        <div className="card">
          <h3>预览（{parsed.label} · {parsed.mode === 'paper' ? '试卷模式' : '课件模式'}）</h3>
          {parsed.mode === 'paper' ? (
            <p className="hint">切出 {parsed.stats.questions} 道题，{parsed.stats.withAnswer} 道匹配到答案，{parsed.stats.withExplanation} 道带解析，{parsed.stats.choice} 道选择题{parsed.stats.answerBlock ? '；找到了文末答案区' : '；没找到文末答案区'}。</p>
          ) : (
            <p className="hint">{parsed.stats.pages} 页转出 {parsed.stats.cards} 张知识卡，跳过 {parsed.stats.skipped} 页过渡页。</p>
          )}
          {(parsed.warnings || []).slice(0, 6).map((w, i) => <div className="warn" key={i}>⚠ {w}</div>)}
          {low ? (
            <div className="warn">
              <p>这份内容<b>不太像试卷</b>（{(parsed.confidenceReasons || []).join('；')}）。切出的内容见下——请逐条核对；确认无误再勾选下方开关导入。</p>
              <label className="check"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />我看过下面的内容，确认是题目</label>
            </div>
          ) : null}
          <div className="itemList">
            {parsed.items.slice(0, 40).map((it, i) => (
              <label className="check" key={i}>
                <input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} />
                <span className="hint">[{subjectLabel(it.subject)}]</span>
                <span>{(it.question || '').slice(0, 70)}{(it.question || '').length > 70 ? '…' : ''}</span>
                {it.answer ? <span className="ok"> → {it.answer.slice(0, 24)}</span> : <span className="hint">（无答案）</span>}
              </label>
            ))}
            {parsed.items.length > 40 ? <p className="hint">另有 {parsed.items.length - 40} 条未展示（默认全部选中）。</p> : null}
          </div>
          <div className="row end">
            <button type="button" className="btn ghost" onClick={() => setParsed(null)}>放弃</button>
            <button type="button" className="btn primary" onClick={doImport} disabled={low && !sure}>入库（已勾 {Object.values(checked).filter(Boolean).length} 条）</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}