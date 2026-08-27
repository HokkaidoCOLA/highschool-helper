// SPDX-License-Identifier: GPL-3.0-or-later
/** 应用骨架：底部标签导航 + 七个页面。 */
import React from 'react'
import Today from './Today.jsx'
import Review from './Review.jsx'
import Library from './Library.jsx'
import Demos from './Demos.jsx'
import Docs from './Docs.jsx'
import Stats from './Stats.jsx'
import Settings from './Settings.jsx'

const TABS = [
  { key: 'today', label: '今日', C: Today },
  { key: 'review', label: '复习', C: Review },
  { key: 'library', label: '题库', C: Library },
  { key: 'demos', label: '演示', C: Demos },
  { key: 'docs', label: '资料', C: Docs },
  { key: 'stats', label: '统计', C: Stats },
  { key: 'settings', label: '设置', C: Settings },
]

export default function App() {
  const [tab, setTab] = React.useState('today')
  const [reviewSubject, setReviewSubject] = React.useState(undefined)
  const goReview = (subject) => { setReviewSubject(subject); setTab('review') }
  const current = TABS.find((t) => t.key === tab)
  const Page = current.C

  return (
    <div className="app">
      <header className="appHeader">
        <h1>高中助学</h1>
        <span className="appSub">语 · 数 · 英 · 物 · 化 · 地</span>
      </header>
      <main className="appMain" key={tab}>
        <Page
          goReview={goReview}
          subject={reviewSubject}
          onChangeSubject={setReviewSubject}
          onExit={tab === 'review' ? () => setTab('today') : undefined}
        />
      </main>
      <nav className="appTabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={tab === t.key ? 'appTab on' : 'appTab'} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </nav>
    </div>
  )
}
