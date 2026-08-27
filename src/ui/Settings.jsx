// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 设置页：学情设置、教材章节进度（原「计划」职能并入）、数据备份/恢复/迁移。
 * 备份文件名与 DSH 插件数据目录完全一致——电脑上的 ~/.dsh/highschool-tutor/*.json
 * 可直接在这里导入迁移（反之亦然）。
 */
import React from 'react'
import { store, notify } from '../state.js'
import { SUBJECTS, subjectLabel } from '../core/subjects.js'
import { syllabusFor } from '../core/syllabus.js'
import { dataDir } from '../core/store.js'
import { useTick, downloadText } from './shared.jsx'
import { loadAiConfig, saveAiConfig, testConnection, DEFAULT_SYSTEM } from '../ai/llm.js'

const FILENAMES = ['profile.json', 'items.json', 'reviews.json', 'studylog.json', 'exams.json', 'demos.json']

function AiCard() {
  const initial = loadAiConfig()
  const [form, setForm] = React.useState({
    baseUrl: initial.baseUrl || '', apiKey: initial.apiKey || '', model: initial.model || '',
    systemPrompt: initial.systemPrompt || '', temperature: initial.temperature === undefined ? '' : String(initial.temperature),
  })
  const [testing, setTesting] = React.useState(false)
  const [result, setResult] = React.useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = () => {
    const cfg = { baseUrl: form.baseUrl.trim(), model: form.model.trim() }
    if (form.apiKey.trim() !== '') cfg.apiKey = form.apiKey.trim(); else if (initial.apiKey) cfg.apiKey = initial.apiKey
    if (form.systemPrompt.trim() !== '') cfg.systemPrompt = form.systemPrompt.trim()
    if (form.temperature.trim() !== '' && Number.isFinite(Number(form.temperature))) cfg.temperature = Number(form.temperature)
    saveAiConfig(cfg)
    setResult('已保存（仅存本机）')
  }
  const test = async () => {
    setTesting(true); setResult('')
    try { setResult('✔ 连通：' + (await testConnection()).slice(0, 40)) }
    catch (err) { setResult('✗ ' + String(err && err.message ? err.message : err)) }
    setTesting(false)
  }
  return (
    <div className="card">
      <h3>AI 接入（可选）</h3>
      <p className="hint">填任意 OpenAI 兼容服务（baseURL 形如 https://api.openai.com/v1）。对话、拍照讲题、文件录入靠它；不接也不影响复习/题库/演示。密钥只存本机。</p>
      <label className="field wide">baseURL<input className="input" placeholder="https://…/v1" value={form.baseUrl} onChange={set('baseUrl')} /></label>
      <label className="field wide">API Key<input className="input" type="password" placeholder="sk-…" value={form.apiKey} onChange={set('apiKey')} /></label>
      <div className="row">
      <label className="field">模型名<input className="input grow" placeholder="支持工具调用；讲题识图需支持视觉" value={form.model} onChange={set('model')} /></label>
      <label className="field">温度（可选）<input className="input num" placeholder="0.7" value={form.temperature} onChange={set('temperature')} /></label>
      </div>
      <label className="field wide">系统提示（可选，留空用内置教练规则）
        <textarea className="input tall" placeholder={DEFAULT_SYSTEM.slice(0, 120) + '…'} value={form.systemPrompt} onChange={set('systemPrompt')} />
      </label>
      <div className="row">
        <button type="button" className="btn primary" onClick={save}>保存</button>
        <button type="button" className="btn" onClick={test} disabled={testing || form.baseUrl === '' || form.model === ''}>{testing ? '测试中…' : '测试连接'}</button>
      </div>
      {result !== '' ? <p className={result.startsWith('✔') ? 'ok' : 'warn'}>{result}</p> : null}
    </div>
  )
}

export default function Settings() {
  const tick = useTick()
  const profile = store.profile()
  const [form, setForm] = React.useState({
    grade: profile.grade || '', examDate: profile.examDate || '', region: profile.region || '',
    dailyReviewTarget: profile.dailyReviewTarget, dailyStudyMinutes: profile.dailyStudyMinutes, newPerDay: profile.newPerDay,
  })
  const [subjects, setSubjects] = React.useState(profile.subjects)
  const [progSubject, setProgSubject] = React.useState('math')
  const progress = store.chapterProgress()
  const notes = store.recentNotes(8)

  const save = () => {
    store.saveProfile({
      grade: form.grade || null,
      examDate: form.examDate || undefined,
      region: form.region || undefined,
      dailyReviewTarget: Number(form.dailyReviewTarget) || 0,
      dailyStudyMinutes: Number(form.dailyStudyMinutes) || 0,
      newPerDay: Number(form.newPerDay) || 0,
      subjects,
    })
    notify()
    window.alert('已保存。' + (form.grade ? '高考日期按年级推算，除非你手动指定。' : ''))
  }

  const backup = async () => {
    await store.flush()
    downloadText('hst-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(store.exportAll(), null, 2), 'application/json')
  }

  const restore = async (fileList) => {
    const files = [...(fileList || [])]
    if (files.length === 0) return
    try {
      let data = {}
      if (files.length === 1 && files[0].name.startsWith('hst-backup')) {
        data = JSON.parse(await files[0].text())
      } else {
        for (const file of files) {
          const key = FILENAMES.find((f) => file.name.endsWith(f))
          if (key !== undefined) data[key] = JSON.parse(await file.text())
          else {
            // 单个合并 JSON（备份导出）
            try { Object.assign(data, JSON.parse(await file.text())) } catch { /* 忽略非 JSON */ }
          }
        }
      }
      const r = store.importAll(data)
      await store.flush()
      notify()
      tick()
      window.alert('已导入：' + (r.replaced.join('、') || '无匹配文件') + (r.skipped.length > 0 ? '；跳过 ' + r.skipped.join('、') : ''))
    } catch (err) {
      window.alert('导入失败：' + String(err && err.message ? err.message : err))
    }
  }

  const cycle = (chapter, current) => {
    const next = current === 'done' ? 'todo' : current === 'doing' ? 'done' : 'doing'
    store.logStudy({ subject: progSubject, chapter, status: next })
    notify()
  }

  return (
    <div>
      <div className="card">
        <h3>学情设置</h3>
        <div className="row">
          <label className="field">年级
            <select className="input" value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}>
              <option value="">未设置</option><option value="g1">高一</option><option value="g2">高二</option><option value="g3">高三</option>
            </select>
          </label>
          <label className="field">高考日期
            <input className="input" type="date" value={form.examDate} onChange={(e) => setForm((f) => ({ ...f, examDate: e.target.value }))} />
          </label>
        </div>
        <label className="field wide">考区/教材
          <input className="input" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
        </label>
        <div className="row">
          <label className="field">每日复习目标
            <input className="input num" type="number" value={form.dailyReviewTarget} onChange={(e) => setForm((f) => ({ ...f, dailyReviewTarget: e.target.value }))} />
          </label>
          <label className="field">每日学习分钟
            <input className="input num" type="number" value={form.dailyStudyMinutes} onChange={(e) => setForm((f) => ({ ...f, dailyStudyMinutes: e.target.value }))} />
          </label>
          <label className="field">每日新卡上限
            <input className="input num" type="number" value={form.newPerDay} onChange={(e) => setForm((f) => ({ ...f, newPerDay: e.target.value }))} />
          </label>
        </div>
        <div className="row wrap">
          {SUBJECTS.map((s) => (
            <label key={s.key} className="check">
              <input type="checkbox" checked={subjects.includes(s.key)} onChange={(e) => setSubjects((v) => (e.target.checked ? [...v, s.key] : v.filter((k) => k !== s.key)))} />
              {s.label}
            </label>
          ))}
        </div>
        <button type="button" className="btn primary" onClick={save}>保存设置</button>
      </div>

      <AiCard />

      <div className="card">
        <h3>教材章节进度（人教版新教材）</h3>
        <div className="row">
          <select className="input" value={progSubject} onChange={(e) => setProgSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          <span className="hint grow">点章节循环切换：未开始 → 进行中 → 已看完</span>
        </div>
        {syllabusFor(progSubject, profile.grade).map((m) => (
          <div key={m.book} className="bookBlock">
            <div className="bookTitle">{m.book}{m.grade === 'all' ? '（贯穿专题）' : ''}</div>
            {m.chapters.map((c) => {
              const status = ((progress[progSubject] || {})[c] || {}).status || 'todo'
              return (
                <div key={c} className={'chapterRow st-' + status} onClick={() => cycle(c, status)}>
                  <span className="dotStatus" />{c}
                </div>
              )
            })}
          </div>
        ))}
        {notes.length > 0 ? (
          <div>
            <h4>最近笔记</h4>
            {notes.map((n, i) => <div className="hint" key={i}>{n.date} {n.subject ? '[' + subjectLabel(n.subject) + ']' : ''} {n.text}</div>)}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>数据与迁移</h3>
        <p className="hint">数据位置：{dataDir()}。备份文件里的六个 JSON 与 DSH 插件（~/.dsh/highschool-tutor）同名同构，两边可互相导入迁移。</p>
        <div className="row">
          <button type="button" className="btn" onClick={backup}>导出备份 JSON</button>
          <label className="btn">导入备份/插件数据<input type="file" accept=".json" multiple hidden onChange={(e) => restore(e.target.files)} /></label>
        </div>
        <p className="hint">用法：电脑上把 ~/.dsh/highschool-tutor/ 里的六个 json 传到手机，这里一次选中导入即可（题库、复习进度、演示、成绩全部带过来）。</p>
      </div>

      <div className="card">
        <h3>关于</h3>
        <p className="hint">高中助学 App · 核心调度/切题/渲染引擎移植自 DSH 插件 dsh-highschool-tutor（GPL-3.0-or-later）。v1 数据只存本机；AI 讲题与出题将在后续版本经你配置的模型 API 接入。</p>
      </div>
    </div>
  )
}