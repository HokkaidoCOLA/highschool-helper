// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 会话面板（双环四库 M4 · fan 树导航）：探索会话按 parentId 挂成森林缩进展示
 * （M1 前是平铺列表；风险登记里「分支×世代=森林迷路」由这一版收口）。
 * 冻结的探索只读留档，行上给「🌱 再开一轮」——从 B₂ 档案起第二代（不重放对话）。
 * 两种宿主共用：竖屏覆盖抽屉（ConvDrawer）、横屏常驻左列（ConvPanel 裸用）。
 */
import React from 'react'
import { IconPen, IconTrash } from './icons.jsx'
import { SUBJECTS } from '../core/subjects.js'
import VBar from './VBar.jsx'

/** 列表里的相对时间。 */
export function fmtAgo(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (m < 1) return '刚刚'
  if (m < 60) return m + ' 分钟'
  const h = Math.round(m / 60)
  if (h < 24) return h + ' 小时'
  return Math.round(h / 24) + ' 天'
}

/** 把平铺会话数组排成森林：[{conv, depth}]，根按原序（updatedAt 倒序），子按更新时间倒序。 */
export function treeRows(convs) {
  const byParent = new Map()
  const present = new Set(convs.map((c) => c.id))
  for (const c of convs) {
    const k = c.parentId !== null && c.parentId !== undefined && present.has(c.parentId) ? c.parentId : ''
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k).push(c)
  }
  const rows = []
  const walk = (list, depth) => {
    for (const c of list) {
      rows.push({ conv: c, depth })
      const kids = (byParent.get(c.id) ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt)
      if (depth < 12 && kids.length > 0) walk(kids, depth + 1)
    }
  }
  walk((byParent.get('') ?? []).slice(), 0)
  return rows
}

/** 面板主体（不含抽屉外壳），供抽屉与常驻侧栏复用。 */
export function ConvPanel({ convs, activeId, onClose, onNew, onSwitch, onRename, onDelete, onResume, compact }) {
  const listRef = React.useRef(null)
  const [editing, setEditing] = React.useState(null)
  const [draft, setDraft] = React.useState('')
  const commit = () => {
    if (editing !== null && draft.trim() !== '') onRename(editing, draft.trim())
    setEditing(null)
  }
  const pick = (id) => { onSwitch(id); if (onClose !== undefined) onClose() }
  const rows = treeRows(convs)
  return (
    <div className={'convPanel' + (compact === true ? ' compact' : '')}>
      <div className="drawerHead">
        <b>历史对话</b>
        <button type="button" className="btn sm primary" onClick={() => { onNew(); if (onClose !== undefined) onClose() }}>＋ 新对话</button>
      </div>
      <div className="drawerWrap">
      <div className="drawerList" ref={listRef}>
        {rows.length === 0 ? <p className="hint" style={{ padding: 12 }}>还没有对话</p> : null}
        {rows.map(({ conv: c, depth }) => (
          <div
            key={c.id}
            className={'convItem' + (c.id === activeId ? ' on' : '')}
            style={depth > 0 ? { paddingLeft: 10 + depth * 16 } : undefined}
            onClick={() => { if (editing === null) pick(c.id) }}
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
                  <div className="convTitle">
                    {depth > 0 ? <span className="treeLink">└ </span> : null}
                    {c.parentId ? '↪ ' : ''}{c.frozen === true ? '❄ ' : ''}{c.title}
                  </div>
                  <div className="convMeta">
                    {c.subject !== 'auto' ? <span className="chipDot" style={{ background: (SUBJECTS.find((x) => x.key === c.subject) || { color: '#888' }).color }} /> : null}
                    {c.busy ? '回复中 · ' : ''}{fmtAgo(c.updatedAt)}前 · {c.items.filter((i) => i.kind === 'user').length} 问
                    {c.frozen === true ? ' · 已归档只读' : ''}
                  </div>
                </div>
                {c.frozen === true && onResume !== undefined ? (
                  <button
                    type="button"
                    className="iconBtn xs"
                    title="再开一轮：从这轮的四件套档案起第二代探索（不重放原对话，原会话保持只读）"
                    onClick={(e) => { e.stopPropagation(); onResume(c) }}
                  >🌱</button>
                ) : null}
                <button type="button" className="iconBtn xs" title="重命名" onClick={(e) => { e.stopPropagation(); setEditing(c.id); setDraft(c.title) }}><IconPen size={15} /></button>
                <button type="button" className="iconBtn xs" title="删除" onClick={(e) => { e.stopPropagation(); if (window.confirm('删除「' + c.title + '」？对话记录会一并删除。')) onDelete(c.id) }}><IconTrash size={15} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      <VBar forRef={listRef} />
      </div>
    </div>
  )
}

/** 竖屏：覆盖式抽屉。 */
export default function ConvDrawer({ open, ...panelProps }) {
  return (
    <aside className={'drawer' + (open ? ' open' : '')}>
      <ConvPanel {...panelProps} />
    </aside>
  )
}
