// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * A 环定稿动作（双环四库 M3）：「确定完成」按钮的 LLM 侧执行器，与 explore.js 同构——
 * compactCall 一次独立调用 + 严格 JSON；失败返回可读错误、数据不动（可重试）。
 * 判定权在用户（D4）：只有 UI 按钮点击（或用户在对话里让教练调 tutor_task finish，
 * 且带 confirmedByUser:true）才会走到这里。
 */
import { store, notify } from '../state.js'
import { compactCall } from './llm.js'
import { TASK_FINISH_PROMPT } from '../core/prompts.js'

/** 任务 → 送样：A₁/A₂/评分/gaps 的紧凑摘要（gap 带弱点表里最近一条证据）。 */
export function taskDigestOf(t) {
  const gaps = (Array.isArray(t.gaps) ? t.gaps : []).slice(0, 8).map((g) => {
    const w = store.getWeakness(g.weaknessId)
    const last = w && Array.isArray(w.evidence) && w.evidence.length > 0 ? w.evidence[w.evidence.length - 1] : null
    return { node: g.node, cleared: Boolean(g.cleared), clearedVia: g.clearedVia ?? null, quote: last ? last.quote : '' }
  })
  return {
    goal: t.goal,
    subject: t.subject,
    nodes: t.nodes,
    plan: t.plan,
    materials: (t.materials || []).slice(-8).map((m) => String(m.quote || '').slice(0, 300)),
    deliverables: (t.deliverables || []).slice(-6).map((d) => String(d.text || '').slice(0, 600)),
    score: t.score,
    gaps,
  }
}

/**
 * 严格 JSON → { summary, cards[] }。容忍三重反引号围栏与前后夹带文字。
 * 空 cards 判失败——定稿没有卡就没有意义，让调用方提示重试。
 * @param {string} raw 模型输出。
 * @returns {object|null} 解析结果或 null。
 */
export function parseFinishJson(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  let s = raw.trim()
  const FENCE = '\u0060\u0060\u0060'
  const fence = s.match(new RegExp('^' + FENCE + '(?:json)?\\s*([\\s\\S]*?)\\s*' + FENCE + '$'))
  if (fence) s = fence[1].trim()
  if (!s.startsWith('{')) {
    const a = s.indexOf('{')
    const b = s.lastIndexOf('}')
    if (a < 0 || b <= a) return null
    s = s.slice(a, b + 1)
  }
  let obj
  try { obj = JSON.parse(s) } catch { return null }
  if (obj === null || typeof obj !== 'object') return null
  const str = (v, cap) => (typeof v === 'string' ? v.trim().slice(0, cap) : '')
  const cards = (Array.isArray(obj.cards) ? obj.cards : []).slice(0, 6).map((c) => ({
    subject: str(c && c.subject, 12).toLowerCase(),
    topic: str(c && c.topic, 60),
    question: str(c && c.question, 1200),
    answer: str(c && c.answer, 1200),
    explanation: str(c && c.explanation, 1200),
  })).filter((c) => c.question !== '' && c.answer !== '')
  if (cards.length === 0) return null
  return { summary: str(obj.summary, 500), cards }
}

/**
 * 「确定完成」：蒸馏总结卡 → finishTask 落库（任务收口 done，卡进艾宾浩斯排期）。
 * 永不抛错。
 * @param {string} taskId 任务 id。
 * @returns {Promise<{ok: boolean, task?: object, cards?: string[], errors?: string[], error?: string}>} 结果。
 */
export async function finishTaskWithAI(taskId) {
  const t = store.getTask(taskId)
  if (t === null || t === undefined) return { ok: false, error: '任务不存在' }
  if (t.status !== 'active') return { ok: false, error: '任务已定稿（' + t.status + '），不重复' }
  try {
    const raw = await compactCall({ system: TASK_FINISH_PROMPT, user: JSON.stringify(taskDigestOf(t), null, 1) })
    const parsed = parseFinishJson(raw)
    if (parsed === null) throw new Error('定稿输出不是可解析的严格 JSON，请重试')
    const r = store.finishTask(taskId, parsed)
    if (r.task === null) throw new Error((r.errors || []).join('；') || '定稿落库失败')
    notify()
    return { ok: true, task: r.task, cards: r.cards, errors: r.errors }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) }
  }
}
