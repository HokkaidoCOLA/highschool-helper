// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 任务页（双环四库 M3 · A 环最小 UI）：表单建任务 + 列表闭环操作。
 * 刻意不做漂亮皮——plan 勾选、gaps 状态、「确定完成」定稿（D4 判定权在用户）都在这一页收口。
 * 完整体验从聊天开始：拍整套题 → 教练 tutor_task create 挂标签出计划。
 */
import React from 'react'
import { store, notify } from '../state.js'
import { useTick, Chip } from './shared.jsx'
import { SUBJECTS } from '../core/subjects.js'
import { aiReady } from '../ai/llm.js'
import { finishTaskWithAI } from '../ai/task.js'

export default function Tasks() {
  useTick()
  const [goal, setGoal] = React.useState('')
  const [subject, setSubject] = React.useState('math')
  const [nodesText, setNodesText] = React.useState('')
  const [finishing, setFinishing] = React.useState(null)
  const [msg, setMsg] = React.useState('')
  const { tasks } = store.listTasks({ limit: 50 })
  const active = tasks.filter((t) => t.status === 'active')
  const done = tasks.filter((t) => t.status === 'done')

  const create = () => {
    const g = goal.trim()
    if (g === '') return
    store.saveTask({ goal: g, subject, nodes: nodesText.split(/[,，、;；\s]+/).filter(Boolean).slice(0, 12) })
    setGoal(''); setNodesText('')
    setMsg('任务已建。A₁ 材料建议回聊天拍照/贴题让教练 tutor_task create 补全并出计划。')
    notify()
  }

  const doFinish = async (t) => {
    const open = (t.gaps || []).filter((g) => !g.cleared)
    if (open.length > 0 && !window.confirm('还有 ' + open.length + ' 条不足未清零，确定提前收口定稿？')) return
    else if (open.length === 0 && !window.confirm('确定完成「' + t.goal + '」？AI 将总结定稿卡入复习库。')) return
    if (!aiReady()) { setMsg('定稿需要模型：先到「设置 → AI 接入」配置'); return }
    setFinishing(t.id)
    const r = await finishTaskWithAI(t.id)
    setFinishing(null)
    setMsg(r.ok ? '已定稿：' + r.cards.length + ' 张总结卡进入复习库排期' + ((r.errors || []).length > 0 ? '（' + r.errors.join('；') + '）' : '') : '定稿失败：' + r.error)
    notify()
  }

  const gapState = (g) => {
    const w = store.getWeakness(g.weaknessId)
    return w !== null && w !== undefined ? w.status : '?'
  }

  return (
    <div className="pageTasks">
      <div className="card">
        <h3>新任务</h3>
        <p className="hint">更省力的入口在聊天：拍一套题说「建个任务」，教练会摘 A₁ 材料、打知识点标签、出计划。</p>
        <div className="row">
          <input className="input grow" placeholder='目标，如「周五前搞定这 6 道导数大题」' value={goal} onChange={(e) => setGoal(e.target.value)} />
          <select className="input subjPick" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="row">
          <input className="input grow" placeholder='知识点标签（可选，逗号分隔，如：复合函数的求导法则,导数与单调性）' value={nodesText} onChange={(e) => setNodesText(e.target.value)} />
          <button type="button" className="btn primary" onClick={create} disabled={goal.trim() === ''}>建任务</button>
        </div>
        {msg !== '' ? <p className="notice">{msg}</p> : null}
      </div>

      <div className="card">
        <h3>进行中（{active.length}）</h3>
        {active.length === 0 ? <p className="hint">没有活跃任务。活跃任务存在时，补习队列按任务节点交集过滤（D1②）。</p> : null}
        {active.map((t) => (
          <div className="taskRow" key={t.id}>
            <div className="row">
              <span className="taskGoal grow">{t.goal}</span>
              {t.readyToFinish === true ? <span className="readyChip">可定稿</span> : null}
            </div>
            <div className="chips">{(t.nodes || []).slice(0, 6).map((n) => <span className="chip" key={n}>{n}</span>)}</div>
            {t.score ? <p className="hint">评分 {t.score.value}{t.score.full ? '/' + t.score.full : ''}{t.score.comment ? ' · ' + t.score.comment : ''}</p> : null}
            {t.plan && t.plan.length > 0 ? (
              <div className="planList">
                {t.plan.map((p, i) => (
                  <label key={i} className={'planStep' + (p.done ? ' doneStep' : '')}>
                    <input type="checkbox" checked={p.done === true} onChange={(e) => { store.setTaskPlanDone(t.id, i, e.target.checked); notify() }} />
                    {p.text}
                  </label>
                ))}
              </div>
            ) : null}
            {(t.gaps || []).length > 0 ? (
              <div className="gapList">
                <span className="hint">不足清单（与补习队列同源）：</span>
                {t.gaps.map((g) => (
                  <div key={g.weaknessId} className={'gapRow' + (g.cleared ? ' gapDone' : '')}>
                    {g.cleared ? '✓' : '·'} <span className="grow">{g.node}</span>
                    <span className="hint">{g.cleared ? '已清零（' + (g.clearedVia || '') + '）' : gapState(g)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="hint">产出 {t.deliverables.length} 份 · 材料 {t.materials.length} 份 · 交卷去聊天说「交了」</p>
            <button type="button" className="btn primary blockBtn finishBtn" disabled={finishing !== null} onClick={() => doFinish(t)}>
              {finishing === t.id ? 'AI 总结定稿中…' : '确定完成（定稿卡入复习库）'}
            </button>
          </div>
        ))}
      </div>

      {done.length > 0 ? (
        <div className="card">
          <h3>已定稿（{done.length}）</h3>
          {done.slice(0, 10).map((t) => (
            <div className="taskRow" key={t.id}>
              <div className="row"><span className="taskGoal grow">{t.goal}</span><span className="hint">{t.cardIds.length} 卡</span></div>
              {t.summary !== '' ? <p className="hint">{t.summary}</p> : null}
              {t.score ? <p className="hint">最终评分 {t.score.value}{t.score.full ? '/' + t.score.full : ''}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
