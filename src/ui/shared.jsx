// SPDX-License-Identifier: GPL-3.0-or-later
/** 共用小组件与工具函数（移动优先，样式在 app.css / mobile.css）。 */
import React from 'react'
import { subscribe, store } from '../state.js'
import { SUBJECTS } from '../core/subjects.js'
import { fmtIntervalDays } from './format.js'

/** 数据变更后强制重渲染（任何写操作调用 notify()）。 */
export function useTick() {
  const [, setV] = React.useState(0)
  React.useEffect(() => subscribe(() => setV((v) => v + 1)), [])
  return () => setV((v) => v + 1)
}

/** 每次渲染重新计算总览。 */
export function useOverview() {
  useTick()
  return store.overview()
}

export function Chip({ subject, count }) {
  const s = SUBJECTS.find((x) => x.key === subject)
  if (!s) return null
  return (
    <span className="chip" title={s.label}>
      <span className="chipDot" style={{ background: s.color }} />
      {s.label}
      {count !== undefined && <b className="chipNum">{count}</b>}
    </span>
  )
}

export function Stat({ num, label, color }) {
  return (
    <div className="stat">
      <div className="statNum" style={color ? { color } : undefined}>{num}</div>
      <div className="statLabel">{label}</div>
    </div>
  )
}

export function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="bar">
      <div className="barFill" style={{ width: pct + '%', background: color || 'var(--brand)' }} />
    </div>
  )
}

export const GRADES = [
  { key: 'again', label: '重来', color: '#dc2626' },
  { key: 'hard', label: '困难', color: '#e08b1a' },
  { key: 'good', label: '良好', color: '#2f6df6' },
  { key: 'easy', label: '简单', color: '#16a34a' },
]

export function GradeButtons({ item, onGrade, disabled }) {
  return (
    <div className="grades">
      {GRADES.map((g) => (
        <button key={g.key} type="button" className="gradeBtn" disabled={disabled} style={{ borderColor: g.color }} onClick={() => onGrade(g.key)}>
          <span className="gradeLabel" style={{ color: g.color }}>{g.label}</span>
          <span className="gradeSub">{g.key === 'again' ? '20分钟后' : fmtIntervalDays(item.preview ? item.preview[g.key] : null)}</span>
        </button>
      ))}
    </div>
  )
}

export function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
