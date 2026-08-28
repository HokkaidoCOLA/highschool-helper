import './ui-stub.mjs'
import React from 'react'
import { renderToStaticMarkup as rs } from 'react-dom/server'
import { store } from '../src/state.js'
import Today from '../src/ui/Today.jsx'
import Chat from '../src/ui/Chat.jsx'
import Review from '../src/ui/Review.jsx'

await store.load()
// 手机实况：全新安装，未设年级、题库为空
const data = store.overview()
console.log('examDate:', data.profile.examDate, 'days:', data.countdown.days, 'due:', data.due.total, 'weak:', data.weakTopics.length, 'exams:', data.recentExams.length)
for (const [name, node] of [['Today', <Today goReview={() => {}} goSettings={() => {}} />], ['Chat', <Chat goSettings={() => {}} />], ['Review', <Review onChangeSubject={() => {}} goSettings={() => {}} />]]) {
  try {
    const html = rs(node)
    console.log(name, 'OK len=', html.length)
  } catch (err) {
    console.log(name, 'CRASH:', String(err && err.message ? err.message : err))
  }
}