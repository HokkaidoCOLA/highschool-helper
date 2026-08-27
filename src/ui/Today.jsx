// SPDX-License-Identifier: GPL-3.0-or-later
/** 今日页：高考倒计时、复习进度、快速记时长、薄弱知识点。 */
import React from 'react'
import { useOverview } from './shared.jsx'
import { Stat, Bar, Chip } from './shared.jsx'
import { store, notify } from '../state.js'
import { SUBJECTS } from '../core/subjects.js'
import { subjectLabel } from '../core/subjects.js'

export default function Today({ goReview }) {
  const data = useOverview()
  const [minutes, setMinutes] = React.useState('30')
  const [logSubject, setLogSubject] = React.useState('math')
  const dueTotal = data.due.total + data.due.new
  const [quickNotes, setQuickNotes] = React.useState('')

  const addMinutes = () => {
    const m = Math.trunc(Number(minutes) || 0)
    if (m === 0) return
    store.logStudy({ subject: logSubject, minutes: m })
    notify()
  }
  const addNote = () => {
    const text = quickNotes.trim()
    if (text === '') return
    store.logStudy({ subject: logSubject, note: text })
    setQuickNotes('')
    notify()
  }

  return (
    <div>
      <div className="card hero">
        <div className="heroDays">{data.countdown.days === null ? '未设置高考日期' : data.countdown.days}</div>
        <div className="heroLabel">{data.countdown.days === null ? '去「设置」选择年级' : '天 · 距高考（' + (data.profile.examDate || '') + '）'}</div>
        <div className="heroRow">
          <Stat num={dueTotal} label="今日待复习" color={dueTotal > 0 ? '#dc2626' : '#16a34a'} />
          <Stat num={data.study.reviewedToday + '/' + data.study.reviewTarget} label="已复习/目标" />
          <Stat num={data.study.minutes + '/' + data.study.target} label="学习分钟" />
          <Stat num={data.study.streak} label="连续天数" color="#e08b1a" />
        </div>
        <Bar value={data.study.minutes} max={data.study.target} />
      </div>

      <button type="button" className="primaryBlock" disabled={dueTotal === 0} onClick={goReview}>
        {dueTotal === 0 ? '今日队列已清空' : '开始复习（' + dueTotal + ' 张）'}
      </button>

      <div className="card">
        <h3>分科待复习</h3>
        <div className="chips">
          {SUBJECTS.map((s) => (
            <button key={s.key} type="button" className="chipBtn" onClick={() => goReview(s.key)}>
              <Chip subject={s.key} count={(data.due.bySubject[s.key] || 0) + (data.due.newBySubject[s.key] || 0)} />
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>快速记一笔</h3>
        <div className="row">
          <select className="input" value={logSubject} onChange={(e) => setLogSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <input className="input num" type="number" min="5" step="5" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <span className="unit">分钟</span>
          <button type="button" className="btn" onClick={addMinutes}>记录</button>
        </div>
        <div className="row">
          <input className="input grow" placeholder="随手笔记，如：导数含参讨论还不熟" value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNote() }} />
          <button type="button" className="btn" onClick={addNote}>记</button>
        </div>
      </div>

      <div className="card">
        <h3>薄弱知识点</h3>
        {data.weakTopics.length === 0 ? <p className="hint">还没有可统计的复习记录——先去复习或导入内置卡片包。</p> : null}
        {data.weakTopics.map((w, i) => (
          <div className="weakRow" key={w.subject + w.topic}>
            <span className="weakRank">{i + 1}</span>
            <Chip subject={w.subject} />
            <span className="weakTopic">{w.topic}</span>
            <span className="weakMeta">{w.accuracy === null ? '未复习' : '正确率 ' + w.accuracy + '%'} · 掌握度 {w.mastery}</span>
          </div>
        ))}
      </div>

      {data.recentExams.length > 0 ? (
        <div className="card">
          <h3>最近模考</h3>
          {data.recentExams.slice(-3).map((e) => (
            <div className="examRow" key={e.id}>
              <b>{e.name}</b>
              <span className="hint">{e.date}</span>
              <span className="examScore">{e.total}/{e.totalFull}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
