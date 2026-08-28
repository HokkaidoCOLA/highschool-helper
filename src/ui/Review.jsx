// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 复习页：今日队列翻卡（对应插件的 tutor_review_deck / DeckCard）。
 * 看题干 → 心里/纸上作答 → 显示答案 → 四档评分当场写入艾宾浩斯排期；
 * 「重来」的卡本轮队尾重现一次；有 linked 演示的卡在题干上方分步演示。
 */
import React from 'react'
import { store, notify } from '../state.js'
import { previewIntervals, mastery } from '../core/srs.js'
import { subjectLabel } from '../core/subjects.js'
import { GradeButtons, useTick, Chip } from './shared.jsx'
import { showScene, hideStage } from '../engine/boot.js'
import VBar from './VBar.jsx'

function decorate(it) {
  const now = Date.now()
  return {
    id: it.id, subject: it.subject, topic: it.topic, kind: it.kind,
    question: it.question, answer: it.answer, explanation: it.explanation, source: it.source,
    difficulty: it.difficulty, preview: previewIntervals(it.srs, now), masteryScore: mastery(it, now),
    srs: { state: it.srs.state, reps: it.srs.reps, lapses: it.srs.lapses },
  }
}

/** 找这道卡关联的演示场景（插件版走 /demos?itemId=，本地直接查演示库）。 */
function demoSceneFor(itemId) {
  const row = store.demoDb().demos.find((d) => d.itemId === itemId)
  return row ? row.scene : null
}

export default function Review({ subject, onChangeSubject, onExit }) {
  const tick = useTick()
  const [limit, setLimit] = React.useState(5)
  const [batch, setBatch] = React.useState(0)
  const queueRef = React.useRef(null)
  const [idx, setIdx] = React.useState(0)
  const [revealed, setRevealed] = React.useState(false)
  const [tally, setTally] = React.useState({ again: 0, hard: 0, good: 0, easy: 0 })
  const againRef = React.useRef(new Set())
  const startRef = React.useRef(Date.now())
  const stageRef = React.useRef(null)
  const stageRef2 = React.useRef(null)

  if (queueRef.current === null || queueRef.current.batch !== batch) {
    const q = store.queue({ subject: subject || undefined, limit })
    queueRef.current = { batch, items: q.items.map(decorate), counts: q.counts }
  }
  const queue = queueRef.current.items

  const item = queue[idx]

  // 演示装载：翻面前只展示带 q 标记的题面信息（lockFirst + questionsOnly），翻面后放开
  React.useEffect(() => {
    if (!item) { hideStage(); return }
    const scene = demoSceneFor(item.id)
    if (scene === null || stageRef.current === null) { hideStage(); return }
    showScene(stageRef.current, scene, { bare: true, compact: true, lockFirst: !revealed, questionsOnly: !revealed })
  }, [item && item.id, revealed])

  const go = (next) => { setIdx(next); setRevealed(false); startRef.current = Date.now() }

  const grade = (g) => {
    if (!item) return
    const elapsedMs = Date.now() - startRef.current
    store.review([{ id: item.id, grade: g, elapsedMs }])
    setTally((t) => ({ ...t, [g]: t[g] + 1 }))
    if (g === 'again' && !againRef.current.has(item.id)) {
      againRef.current.add(item.id)
      queueRef.current.items = queue.concat([item])
    }
    notify()
    const next = idx + 1
    if (next >= queueRef.current.items.length) {
      queueRef.current = null
      setBatch((b) => b + 1)
      setIdx(0)
      tick()
    } else {
      go(next)
    }
  }

  // 键盘：空格翻面（评分按钮用数字 1-4）
  React.useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === ' ' && !revealed) { ev.preventDefault(); setRevealed(true) }
      else if (revealed && ['1', '2', '3', '4'].includes(ev.key)) grade(GRADE_KEYS[Number(ev.key) - 1])
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  React.useEffect(() => () => hideStage(), [])

  if (!item) {
    return (
      <div>
        <div className="card doneCard">
          <h2>本轮完成</h2>
          <div className="tallyRow">
            <span style={{ color: '#dc2626' }}>重来 {tally.again}</span>
            <span style={{ color: '#e08b1a' }}>困难 {tally.hard}</span>
            <span style={{ color: '#2f6df6' }}>良好 {tally.good}</span>
            <span style={{ color: '#16a34a' }}>简单 {tally.easy}</span>
          </div>
          <p className="hint">「重来」的题 20 分钟后会重新进入队列；连续天数与保持率已更新。</p>
          <button type="button" className="btn" onClick={() => { setTally({ again: 0, hard: 0, good: 0, easy: 0 }); againRef.current = new Set(); queueRef.current = null; setBatch((b) => b + 1); setIdx(0) }}>再来一轮</button>
          {onExit ? <button type="button" className="btn ghost" onClick={onExit}>退出</button> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="pageReview">
      <div className="row deckHead">
        <select className="input" value={subject || ''} onChange={(e) => { queueRef.current = null; setBatch(0); setIdx(0); onChangeSubject(e.target.value || undefined) }}>
          <option value="">全科</option>
          {['chinese', 'math', 'english', 'physics', 'chemistry', 'geography'].map((k) => <option key={k} value={k}>{subjectLabel(k)}</option>)}
        </select>
        <select className="input" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); queueRef.current = null; setBatch((b) => b + 1); setIdx(0) }}>
          {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} 张/轮</option>)}
        </select>
        <span className="deckPos">{idx + 1}/{queue.length}</span>
      </div>
      <div className="reviewStageWrap" ref={stageRef2}><div ref={stageRef} className="demoHost" /><VBar forRef={stageRef2} /></div>
      <div className="card reviewCard">
        <div className="cardMeta">
          <Chip subject={item.subject} />
          {item.topic ? <span className="hint">{item.topic}</span> : null}
          <span className="hint">难度 {item.difficulty} · 掌握度 {item.masteryScore}</span>
        </div>
        <div className="question">{item.question}</div>
        {!revealed ? (
          <button type="button" className="primaryBlock" onClick={() => setRevealed(true)}>显示答案（空格）</button>
        ) : (
          <div>
            <div className="answer">{item.answer === '' ? '（这张卡没有填答案）' : item.answer}</div>
            {item.explanation !== '' ? <div className="explain">解析：{item.explanation}</div> : null}
            {item.source !== '' ? <div className="hint">来源：{item.source}</div> : null}
            <GradeButtons item={item} onGrade={grade} />
            <div className="hint keyHint">键盘：1 重来 · 2 困难 · 3 良好 · 4 简单</div>
          </div>
        )}
      </div>
    </div>
  )
}

const GRADE_KEYS = ['again', 'hard', 'good', 'easy']