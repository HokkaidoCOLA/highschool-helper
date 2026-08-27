// SPDX-License-Identifier: GPL-3.0-or-later
/** 应用骨架：底部导航八页，聊天为默认主页。 */
import React from 'react'
import Chat from './Chat.jsx'
import Today from './Today.jsx'
import Review from './Review.jsx'
import Library from './Library.jsx'
import Demos from './Demos.jsx'
import Docs from './Docs.jsx'
import Stats from './Stats.jsx'
import Settings from './Settings.jsx'

const TABS = [
  { key: 'chat', label: '聊天', C: Chat },
  { key: 'today', label: '今日', C: Today },
  { key: 'review', label: '复习', C: Review },
  { key: 'library', label: '题库', C: Library },
  { key: 'demos', label: '演示', C: Demos },
  { key: 'docs', label: '资料', C: Docs },
  { key: 'stats', label: '统计', C: Stats },
  { key: 'settings', label: '设置', C: Settings },
]

export default function App() {
  const [tab, setTab] = React.useState('chat')
  const [reviewSubject, setReviewSubject] = React.useState(undefined)
  const goReview = (subject) => { setReviewSubject(subject); setTab('review') }
  const Page = TABS.find((t) => t.key === tab).C
  const fullBleed = tab === 'chat'
  return (
    <div className="app">
      <header className="appHeader">
        <h1>高中助学</h1>
        <span className="appSub">语 · 数 · 英 · 物 · 化 · 地</span>
      </header>
      <main className={'appMain' + (fullBleed ? ' fullBleed' : '')} key={tab}>
        <Page
          goReview={goReview}
          goSettings={() => setTab('settings')}
          subject={reviewSubject}
          onChangeSubject={setReviewSubject}
          onExit={tab === 'review' ? () => setTab('today') : undefined}
        />
      </main>
      <nav className="appTabs eight">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={tab === t.key ? 'appTab on' : 'appTab'} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </nav>
    </div>
  )
}
