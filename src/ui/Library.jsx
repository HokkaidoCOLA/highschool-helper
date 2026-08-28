// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 题库页：检索 / 增删改 / 批量导入（md·表格·csv·anki）/ 导出 Markdown / 内置卡片包。
 * 对应插件设置页「题库」标签 + tutor_add_items / tutor_search_items / tutor_import 的手动入口。
 */
import React from 'react'
import { store, notify } from '../state.js'
import { SUBJECTS, subjectLabel } from '../core/subjects.js'
import { parseImport, toMarkdown } from '../core/importer.js'
import { seedItems } from '../core/seed.js'
import { mastery } from '../core/srs.js'
import { Chip, downloadText, useTick } from './shared.jsx'

const EMPTY = { subject: 'math', kind: 'card', topic: '', question: '', answer: '', explanation: '', tags: '', difficulty: 3, source: '', chapter: '', grade: '' }

function Editor({ value, onClose, onSaved }) {
  const [form, setForm] = React.useState(value || EMPTY)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = () => {
    if (form.question.trim() === '') { toast('题干不能为空'); return }
    const item = { ...form, tags: form.tags === '' ? [] : String(form.tags).split(/[,，\s]+/).filter(Boolean) }
    const r = store.upsertItems([item])
    notify()
    onSaved()
    onClose()
    void r
  }
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>{value && value.id ? '编辑卡片' : '新增卡片'}</h3>
        <div className="row">
          <select className="input" value={form.subject} onChange={set('subject')}>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          <select className="input" value={form.kind} onChange={set('kind')}><option value="card">知识卡</option><option value="mistake">错题</option></select>
          <select className="input" value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: Number(e.target.value) || 3 }))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>难度 {n}</option>)}</select>
        </div>
        <input className="input" placeholder="知识点（如：一元函数的导数及其应用）" value={form.topic} onChange={set('topic')} />
        <textarea className="input tall" placeholder="题干 / 卡片正面 *" value={form.question} onChange={set('question')} />
        <textarea className="input" placeholder="答案 / 卡片背面" value={form.answer} onChange={set('answer')} />
        <textarea className="input" placeholder="解析、错因、易错提醒" value={form.explanation} onChange={set('explanation')} />
        <div className="row">
          <input className="input grow" placeholder="标签（空格分隔）" value={form.tags} onChange={set('tags')} />
          <input className="input grow" placeholder="来源（如 2024 浙江一模 T18）" value={form.source} onChange={set('source')} />
        </div>
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn primary" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  )
}

function Importer({ onClose }) {
  const [text, setText] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [preview, setPreview] = React.useState(null)
  const run = (dry) => {
    if (text.trim() === '') return
    const r = parseImport(text, subject === '' ? {} : { subject })
    if (dry) { setPreview(r); return }
    const res = store.upsertItems(r.items)
    notify()
    onClose()
    toast('导入完成：新增 ' + res.added.length + ' 条、更新 ' + res.updated.length + ' 条、跳过 ' + res.skipped + ' 条')
  }
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>批量导入（Markdown 问答块 / 表格 / CSV / Anki TSV 自动识别）</h3>
        <div className="row">
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">自动/默认学科</option>
            {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <textarea className="input tall2" placeholder={'## 数学\nQ: 导数的几何意义？\nA: 切线斜率\n#必背\n---'} value={text} onChange={(e) => setText(e.target.value)} />
        {preview !== null ? (
          <div className="preview">
            <p>识别为 <b>{preview.format}</b> 格式，可导入 <b>{preview.items.length}</b> 条。前几条：</p>
            {preview.items.slice(0, 5).map((it, i) => <div className="hint" key={i}>· [{subjectLabel(it.subject)}] {it.question.slice(0, 40)}</div>)}
            {preview.warnings.slice(0, 5).map((w, i) => <div className="warn" key={'w' + i}>⚠ {w}</div>)}
          </div>
        ) : null}
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onClose}>关闭</button>
          <button type="button" className="btn" onClick={() => run(true)}>预览</button>
          <button type="button" className="btn primary" onClick={() => run(false)} disabled={preview === null}>{preview === null ? '先预览' : '确认导入 ' + preview.items.length + ' 条'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Library() {
  const tick = useTick()
  const [filter, setFilter] = React.useState({ subject: '', kind: '', status: 'all', sort: 'updated', query: '' })
  const [draft, setDraft] = React.useState('')
  const [shown, setShown] = React.useState(30)
  const [openId, setOpenId] = React.useState(null)
  const [editing, setEditing] = React.useState(null)
  const [importer, setImporter] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setFilter((f) => (f.query === draft ? f : { ...f, query: draft })), 250)
    return () => clearTimeout(t)
  }, [draft])

  const result = store.listItems({ ...filter, limit: 500 })
  const rows = result.items.slice(0, shown)

  const remove = (id) => {
    if (!window.confirm('删除这张卡？复习进度一并删除。')) return
    store.deleteItems([id])
    notify()
  }
  const exportMd = () => {
    const r = store.listItems({ ...filter, limit: 500 })
    downloadText('高中助学题库-' + store.overview().today + '.md', toMarkdown(r.items, subjectLabel), 'text/markdown')
  }
  const seed = () => {
    const r = store.upsertItems(seedItems())
    notify()
    toast('内置卡片包：新增 ' + r.added.length + ' 条、更新 ' + r.updated.length + ' 条（共 ' + seedItems().length + ' 张，重复导入不会产生重复条目）')
  }

  return (
    <div>
      <div className="row">
        <input className="input grow" placeholder="搜索题干/答案/解析/标签…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="button" className="btn primary" onClick={() => setEditing({ ...EMPTY })}>新增</button>
      </div>
      <div className="row">
        <select className="input" value={filter.subject} onChange={(e) => setFilter((f) => ({ ...f, subject: e.target.value }))}><option value="">全科</option>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        <select className="input" value={filter.kind} onChange={(e) => setFilter((f) => ({ ...f, kind: e.target.value }))}><option value="">类型</option><option value="card">卡片</option><option value="mistake">错题</option></select>
        <select className="input" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}><option value="all">全部</option><option value="due">今日到期</option><option value="new">未学</option><option value="weak">薄弱</option></select>
        <select className="input" value={filter.sort} onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value }))}><option value="updated">按更新</option><option value="due">按到期</option><option value="mastery">掌握度差优先</option><option value="difficulty">按难度</option></select>
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={() => setImporter(true)}>批量导入</button>
        <button type="button" className="btn" onClick={exportMd}>导出 Markdown</button>
        <button type="button" className="btn" onClick={seed}>内置卡片包</button>
        <span className="hint grow right">共 {result.total} 条</span>
      </div>
      {rows.map((it) => (
        <div className={'item' + (openId === it.id ? ' open' : '')} key={it.id}>
          <div className="row v" onClick={() => setOpenId(openId === it.id ? null : it.id)}>
            <Chip subject={it.subject} />
            <span className="itemQ">{it.question.slice(0, 60)}{it.question.length > 60 ? '…' : ''}</span>
            <span className="hint">{mastery(it, Date.now())}</span>
          </div>
          {openId === it.id ? (
            <div className="itemBody">
              {it.topic !== '' ? <p className="hint">{it.topic}</p> : null}
              <p><b>答：</b>{it.answer || '（无）'}</p>
              {it.explanation !== '' ? <p className="hint">解析：{it.explanation}</p> : null}
              <p className="hint">状态 {it.srs.state} · 复习 {it.srs.reps} 次 · 遗忘 {it.srs.lapses} 次{it.source !== '' ? ' · ' + it.source : ''}</p>
              <div className="row end">
                <button type="button" className="btn" onClick={() => setEditing({ ...it, tags: it.tags.join(' '), grade: it.grade || '', chapter: it.chapter || '' })}>编辑</button>
                <button type="button" className="btn danger" onClick={() => remove(it.id)}>删除</button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
      {result.total > shown ? <button type="button" className="btn block" onClick={() => setShown(shown + 40)}>加载更多（剩 {result.total - shown}）</button> : null}
      {rows.length === 0 ? <p className="hint">没有符合条件的卡片。点「内置卡片包」一键导入 60 张高频卡开始复习。</p> : null}
      {editing !== null ? <Editor value={editing} onClose={() => setEditing(null)} onSaved={tick} /> : null}
      {importer ? <Importer onClose={() => setImporter(false)} /> : null}
    </div>
  )
}