// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 应用骨架：底部标签导航 + 七个页面。本轮为占位实现，页面在后续提交逐一填充。
 */
import React from 'react'

const TABS = [
  { key: 'today', label: '今日' },
  { key: 'review', label: '复习' },
  { key: 'library', label: '题库' },
  { key: 'demos', label: '演示' },
  { key: 'docs', label: '资料' },
  { key: 'stats', label: '统计' },
  { key: 'settings', label: '设置' },
]

export default function App() {
  const [tab, setTab] = React.useState('today')
  return (
    <div className="app">
      <header className="appHeader">
        <h1>高中助学</h1>
        <span className="appSub">语 · 数 · 英 · 物 · 化 · 地</span>
      </header>
      <main className="appMain">
        <p className="appHint">「{TABS.find((t) => t.key === tab).label}」页建设中</p>
      </main>
      <nav className="appTabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={tab === t.key ? 'appTab on' : 'appTab'} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </nav>
    </div>
  )
}
