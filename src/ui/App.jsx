// SPDX-License-Identifier: GPL-3.0-or-later
/** 应用骨架：底部导航九页（M3 加「任务」），聊天为默认主页。 */
import React from 'react'
import { IconChat, IconTask, IconToday, IconReview, IconLibrary, IconDemo, IconDocs, IconStats, IconSettings } from './icons.jsx'
import Chat from './Chat.jsx'
import Tasks from './Tasks.jsx'
import Today from './Today.jsx'
import Review from './Review.jsx'
import Library from './Library.jsx'
import Demos from './Demos.jsx'
import Docs from './Docs.jsx'
import Stats from './Stats.jsx'
import Settings from './Settings.jsx'
import VBar from './VBar.jsx'

const TABS = [
  { key: 'chat', label: '聊天', C: Chat, I: IconChat },
  { key: 'tasks', label: '任务', C: Tasks, I: IconTask },
  { key: 'today', label: '今日', C: Today, I: IconToday },
  { key: 'review', label: '复习', C: Review, I: IconReview },
  { key: 'library', label: '题库', C: Library, I: IconLibrary },
  { key: 'demos', label: '演示', C: Demos, I: IconDemo },
  { key: 'docs', label: '资料', C: Docs, I: IconDocs },
  { key: 'stats', label: '统计', C: Stats, I: IconStats },
  { key: 'settings', label: '设置', C: Settings, I: IconSettings },
]

export default function App() {
  const [tab, setTab] = React.useState('chat')
  const tabsRef = React.useRef(null)
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
      <div className="railWrap">
        <nav className="appTabs nine" ref={tabsRef}>
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? 'appTab on' : 'appTab'} onClick={() => setTab(t.key)}>
              <t.I />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <VBar forRef={tabsRef} />
      </div>
    </div>
  )
}