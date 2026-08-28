// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 会话抽屉（Kimi 式左侧栏）：新建 / 切换 / 重命名 / 删除历史对话。
 * 数据来自 ai/session.js 的会话单例；删除确认用原生 confirm（发生在任何写入之前）。
 */
import React from 'react'
import { IconPen, IconTrash } from './icons.jsx'
import { SUBJECTS } from '../core/subjects.js'

/** 列表里的相对时间。 */
export function fmtAgo(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (m < 1) return '刚刚'
  if (m < 60) return m + ' 分钟'
  const h = Math.round(m / 60)
  if (h < 24) return h + ' 小时'
  return Math.round(h / 24) + ' 天'
}

export default function ConvDrawer({ open, convs, activeId, onClose, onNew, onSwitch, onRename, onDelete }) {
  const [editing, setEditing] = React.useState(null)
  const [draft, setDraft] = React.useState('')
  const commit = () => {
    if (editing !== null && draft.trim() !== '') onRename(editing, draft.trim())
    setEditing(null)
  }
  return (
    <aside className={'drawer' + (open ? ' open' : '')}>
      <div className="drawerHead">
        <b>历史对话</b>
        <button type="button" className="btn sm primary" onClick={() => { onNew(); onClose() }}>＋ 新对话</button>
      </div>
      <div className="drawerList">
        {convs.length === 0 ? <p className="hint" style={{ padding: 12 }}>还没有对话</p> : null}
        {convs.map((c) => (
          <div
            key={c.id}
            className={'convItem' + (c.id === activeId ? ' on' : '')}
            onClick={() => { if (editing === null) { onSwitch(c.id); onClose() } }}
          >
            {editing === c.id ? (
              <input
                className="input convRename"
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(null) }}
                onBlur={commit}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="convRow">
                <div className="convText">
                  <div className="convTitle">{c.title}</div>
                  <div className="convMeta">
                    {c.subject !== 'auto' ? <span className="chipDot" style={{ background: (SUBJECTS.find((x) => x.key === c.subject) || { color: '#888' }).color }} /> : null}
                    {c.busy ? '回复中 · ' : ''}{fmtAgo(c.updatedAt)}前 · {c.items.filter((i) => i.kind === 'user').length} 问
                  </div>
                </div>
                <button type="button" className="iconBtn xs" title="重命名" onClick={(e) => { e.stopPropagation(); setEditing(c.id); setDraft(c.title) }}><IconPen size={15} /></button>
                <button type="button" className="iconBtn xs" title="删除" onClick={(e) => { e.stopPropagation(); if (window.confirm('删除「' + c.title + '」？对话记录会一并删除。')) onDelete(c.id) }}><IconTrash size={15} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}