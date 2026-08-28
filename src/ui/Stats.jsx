// SPDX-License-Identifier: GPL-3.0-or-later
/** 统计页：每日复习量/学习时长曲线、各科掌握度、记忆保持率、模考趋势与录入。 */
import React from 'react'
import { store, notify } from '../state.js'
import { SUBJECTS, subjectLabel } from '../core/subjects.js'
import { useTick, toast } from './shared.jsx'

function DailyChart({ series }) {
  if (series.length === 0) return <p className="hint">暂无数据</p>
  const W = 640; const H = 130; const padB = 18
  const maxR = Math.max(1, ...series.map((d) => d.reviews))
  const maxM = Math.max(1, ...series.map((d) => d.minutes))
  const bw = W / series.length
  const pts = series.map((d, i) => (i * bw + bw / 2) + ',' + (H - padB - ((H - padB) * d.minutes) / maxM)).join(' ')
  return (
    <div>
      <svg className="chart" viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" height="130">
        {series.map((d, i) => (
          <rect key={i} x={i * bw + bw * 0.18} y={H - padB - ((H - padB) * d.reviews) / maxR} width={bw * 0.64} height={((H - padB) * d.reviews) / maxR} fill="var(--brand)" opacity="0.5" />
        ))}
        <polyline points={pts} fill="none" stroke="#e08b1a" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <p className="hint">柱=每日复习量（峰值 {maxR}）· 折线=每日学习分钟（峰值 {maxM}）</p>
    </div>
  )
}

function ExamChart({ trend }) {
  if (trend.length === 0) return <p className="hint">还没有模考记录，在下方录入第一次成绩。</p>
  const W = 640; const H = 140
  const pcts = trend.map((e) => e.percent || 0)
  const lo = Math.max(0, Math.min(...pcts) - 5); const hi = Math.min(100, Math.max(...pcts) + 5)
  const x = (i) => trend.length === 1 ? W / 2 : 30 + (i * (W - 60)) / (trend.length - 1)
  const y = (p) => H - 22 - ((p - lo) * (H - 44)) / Math.max(1, hi - lo)
  const pts = trend.map((e, i) => x(i) + ',' + y(e.percent || 0)).join(' ')
  return (
    <div>
      <svg className="chart" viewBox={'0 0 ' + W + ' ' + H} height="140">
        <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="2" />
        {trend.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.percent || 0)} r="3.5" fill="var(--brand)" />)}
        {trend.map((e, i) => <text key={'v' + i} x={x(i)} y={y(e.percent || 0) - 9} textAnchor="middle" fontSize="10" fill="var(--fg2)">{e.total}</text>)}
        {trend.map((e, i) => <text key={'d' + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--fg2)">{e.date.slice(5)}</text>)}
      </svg>
      <p className="hint">纵轴为总分得分率，点上数字为总分</p>
    </div>
  )
}

function ExamForm() {
  const [name, setName] = React.useState('')
  const [date, setDate] = React.useState('')
  const [scores, setScores] = React.useState({})
  const [rank, setRank] = React.useState('')
  const save = () => {
    const list = Object.entries(scores).filter(([, v]) => v !== '' && Number.isFinite(Number(v))).map(([k, v]) => ({ subject: k, score: Number(v) }))
    if (list.length === 0) { toast('至少填一科分数'); return }
    store.saveExam({ name: name || '模考', date: date || undefined, scores: list, rank: rank === '' ? undefined : Number(rank) })
    notify()
    setName(''); setDate(''); setScores({}); setRank('')
    toast('成绩已记录')
  }
  return (
    <div className="examForm">
      <div className="row">
        <input className="input grow" placeholder="名称（如 高二下第一次月考）" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="input num" placeholder="名次" value={rank} onChange={(e) => setRank(e.target.value)} />
      </div>
      <div className="row wrap">
        {SUBJECTS.map((s) => (
          <label key={s.key} className="scoreCell">{s.label}
            <input className="input num2" type="number" inputMode="decimal" value={scores[s.key] || ''} placeholder={s.key === 'chinese' || s.key === 'math' || s.key === 'english' ? '150' : '100'} onChange={(e) => setScores((v) => ({ ...v, [s.key]: e.target.value }))} />
          </label>
        ))}
      </div>
      <button type="button" className="btn primary" onClick={save}>记录成绩</button>
    </div>
  )
}

export default function Stats() {
  const tick = useTick()
  const [days, setDays] = React.useState(14)
  const stats = store.stats(days)
  return (
    <div>
      <div className="row">
        {[7, 14, 30, 90].map((n) => (
          <button key={n} type="button" className={'seg' + (days === n ? ' on' : '')} onClick={() => setDays(n)}>{n} 天</button>
        ))}
      </div>
      <div className="card"><h3>每日复习量与学习时长</h3><DailyChart series={stats.series} /></div>
      <div className="card">
        <h3>记忆保持力</h3>
        <p className="hint">窗口内复习 {stats.retention.reviews} 次 · 一次通过率 {stats.retention.accuracy === null ? '—' : stats.retention.accuracy + '%'} · 熟卡保持率 {stats.retention.matureAccuracy === null ? '—' : stats.retention.matureAccuracy + '%'}（不含新卡首学）</p>
      </div>
      <div className="card">
        <h3>各科掌握度</h3>
        {stats.subjects.map((s) => (
          <div className="masteryRow" key={s.subject}>
            <span className="mLabel">{subjectLabel(s.subject)}</span>
            <div className="bar grow"><div className="barFill" style={{ width: s.mastery + '%', background: SUBJECTS.find((x) => x.key === s.subject).color }} /></div>
            <span className="mNum">{s.mastery}</span>
            <span className="hint">{s.items} 条 · 到期 {s.due}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>模考总分趋势</h3>
        <ExamChart trend={stats.examTrend} />
      </div>
      <div className="card">
        <h3>录入新成绩</h3>
        <ExamForm onSaved={tick} />
      </div>
    </div>
  )
}