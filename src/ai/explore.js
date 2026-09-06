// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * B 环探索归档（双环四库 M1，见研究区 06 篇 §2-B）。
 *
 * 用户点「❄ 这轮完了」→ freezeExploration()：
 *   1. 先冻结会话封口（D4：完成判定权在用户，按钮就是判定动作）；
 *   2. transcript 序列化后经 llm.compactCall 一次独立调用（不占主会话上下文），
 *      按 prompts.EXPLORE_COMPACT_PROMPT 产出四件套 {conclusion, stuckReplay, chain,
 *      openBranches[]} + weaknesses[]（D2①：四件套是第二代的继承存档）；
 *   3. 严格 JSON 解析：成功 → explorations.json 存 B₂ 档案 + 弱点入 weaknesses.json
 *      （status=discovered、source=explore；M1 只入库不注入，验证闸门 M2 建）；
 *      解析失败 → 降级：只存 transcript 指针（degraded 档案），弱点零写入，并解冻会话
 *      提示可重试（transcript 本体永远在会话记录里——D2②）。
 */
import { store, notify } from '../state.js'
import { getConversation, freezeConversation, pushItemTo, forkConversation } from './session.js'
import { compactCall } from './llm.js'
import { EXPLORE_COMPACT_PROMPT, LOOKUP_PROMPT } from '../core/prompts.js'

/** transcript 送样上限（字）：超限留头 6000 + 尾 8000，中段以标记略去。 */
const TRANSCRIPT_CAP = 16000

/**
 * apiMessages → 纯文本对话稿（归档调用的输入）。
 * 跳过 system 头（runAssistant 每轮重建，非对话内容）；tool 结果截断防挤爆样本。
 * @param {object[]} apiMessages 会话模型上下文。
 * @returns {string} 转写文本。
 */
export function transcriptOf(apiMessages) {
  const lines = []
  for (const m of Array.isArray(apiMessages) ? apiMessages : []) {
    if (!m || typeof m !== 'object' || m.role === 'system') continue
    if (m.role === 'user') {
      let text = ''
      if (typeof m.content === 'string') text = m.content
      else if (Array.isArray(m.content)) {
        text = m.content.filter((p) => p && p.type === 'text').map((p) => p.text).join(' ')
        if (m.content.some((p) => p && p.type === 'image_url')) text += '（附图片）'
      }
      lines.push('学生：' + String(text).slice(0, 800))
    } else if (m.role === 'assistant') {
      const text = typeof m.content === 'string' ? m.content : ''
      const calls = Array.isArray(m.tool_calls) ? m.tool_calls.map((c) => c.function && c.function.name).filter(Boolean) : []
      const tail = calls.length > 0 ? '〔调用工具：' + calls.join('、') + '〕' : ''
      if (text !== '' || tail !== '') lines.push('教练：' + text.slice(0, 800) + tail)
    } else if (m.role === 'tool') {
      lines.push('工具结果：' + String(m.content || '').slice(0, 120))
    }
  }
  let out = lines.join('\n')
  if (out.length > TRANSCRIPT_CAP) {
    const head = out.slice(0, 6000)
    const tail = out.slice(out.length - 8000)
    out = head + '\n……（中段 ' + (out.length - head.length - tail.length) + ' 字略）……\n' + tail
  }
  return out
}

/**
 * 严格 JSON → 四件套 + 弱点数组。容忍两种常见脏输出：三重反引号围栏（\u0060×3）、
 * 前后夹带解释文字（截取首个 { 到末个 }）。conclusion 缺失/为空视为解析失败——
 * 没有结论的档案没有价值，降级比硬存好。
 * @param {string} raw 模型输出。
 * @returns {{compact: object, weaknesses: object[]}|null} 解析结果；null=失败，调用方走降级。
 */
export function parseCompactJson(raw) {
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
  const conclusion = str(obj.conclusion, 800)
  if (conclusion === '') return null
  const arr = (v, cap, max) => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined).map((x) => str(typeof x === 'string' ? x : JSON.stringify(x), cap)).filter((x) => x !== '').slice(0, max) : [])
  const compact = {
    conclusion,
    stuckReplay: str(obj.stuckReplay, 1200),
    chain: arr(obj.chain, 300, 12),
    openBranches: arr(obj.openBranches, 200, 8),
  }
  const weaknesses = Array.isArray(obj.weaknesses)
    ? obj.weaknesses.slice(0, 5).map((w) => ({
      subject: str(w && w.subject, 12).toLowerCase(),
      node: str(w && w.node, 60),
      quote: str(w && w.quote, 80),
    })).filter((w) => w.node !== '')
    : []
  return { compact, weaknesses }
}

/**
 * 速查文本清洗（v0.2.1）：容忍围栏/引号包裹，压空白，硬截 240 字。
 * @param {string} raw 模型输出。
 * @returns {string|null} 速查正文；空/不可用返回 null（调用方报错给 UI）。
 */
export function parseLookupText(raw) {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  const FENCE = '\u0060\u0060\u0060'
  const fence = s.match(new RegExp('^' + FENCE + '[a-z]*\\s*([\\s\\S]*?)\\s*' + FENCE + '$'))
  if (fence) s = fence[1].trim()
  s = s.replace(/^["“「]+|["”」]+$/g, '').replace(/\s+/g, ' ').trim()
  if (s === '') return null
  return s.slice(0, 240)
}

/**
 * 词条速查（Explore 式两段交互第一级）：一次旁路 compactCall，80 字内讲清词条在
 * 该语境里的意思——不进会话上下文、不归档、不计档案。
 * @param {string} term 选中的词。
 * @param {string} quote 出现该词的上下文片段。
 * @param {object} [opts] { signal }。
 * @returns {Promise<string>} 速查文本。
 */
export async function lookupTerm(term, quote, opts) {
  const user = '词条：' + String(term).slice(0, 40) + '\n上下文：「' + String(quote || '').slice(0, 300) + '」'
  const raw = await compactCall({ system: LOOKUP_PROMPT, user, signal: opts && opts.signal })
  const text = parseLookupText(raw)
  if (text === null) throw new Error('速查卡没吐出台词，再划一次试试')
  return text
}

/**
 * 划词深入（第二段动作）：锚定 fork 出词条探索会话 + 弱点当场预录 discovered
 * （划词=用户自认，置信 0.5 高于 AI 事后抽取的 0.4；仍须过抽查闸门才进补习队列）。
 * @param {string} convId 母会话 id。
 * @param {number|string} itemId 选区所在消息 id。
 * @param {string} term 词条。
 * @param {string} quote 上下文原句。
 * @returns {{conv: object, weakness: object|null}|null} 新会话与预录记录；分叉失败 null。
 */
export function startTermExploration(convId, itemId, term, quote) {
  const conv = forkConversation(convId, itemId, { term, quote })
  if (conv === null) return null
  const weakness = store.addWeakness({
    subject: conv.subject === 'auto' ? null : conv.subject,
    node: conv.exploreTerm.term, quote: String(quote || '').slice(0, 200),
    src: 'conv:' + convId + '#msg:' + String(itemId), source: 'explore', confidence: 0.5,
  })
  pushItemTo(conv, { kind: 'notice', text: '🔤 「' + conv.exploreTerm.term + '」已记入弱点表（待验证——抽查过了才进补习队列）。聊完点「❄ 这轮完了」归档。' })
  notify()
  return { conv, weakness }
}

/** 会话的对话行数（user/assistant 条目数，档案里做 transcriptCount）。 */
function turnCount(conv) {
  return conv.items.filter((i) => i.kind === 'user' || i.kind === 'assistant').length
}

/**
 * 冻结探索会话并归档（「❄ 这轮完了」的完整动作）。永不抛错，结果用返回值表达。
 * @param {string} convId 会话 id。
 * @returns {Promise<{ok: boolean, degraded?: boolean, error?: string, exploration?: object}>} 归档结果。
 */
export async function freezeExploration(convId) {
  const conv = getConversation(convId)
  if (conv === null) return { ok: false, error: '会话不存在' }
  if (conv.frozen === true) return { ok: false, error: '本轮已冻结' }
  freezeConversation(convId, true)
  pushItemTo(conv, { kind: 'notice', text: '❄ 已封口，正在把本轮探索压成四件套档案…' })
  const base = {
    convId: conv.id, title: conv.title,
    subject: conv.subject === 'auto' ? null : conv.subject,
    parentId: typeof conv.parentId === 'string' ? conv.parentId : '',
    gen: Number.isFinite(conv.gen) ? conv.gen : 1,
    transcriptCount: turnCount(conv),
  }
  try {
    let transcript = transcriptOf(conv.apiMessages)
    if (conv.exploreTerm && typeof conv.exploreTerm.term === 'string' && conv.exploreTerm.term !== '') {
      transcript = '（这是一次词条级探索：用户划出「' + conv.exploreTerm.term + '」说不理解，出处：「' + conv.exploreTerm.quote + '」。'
        + '四件套围绕该词条产出；它已在弱点表，weaknesses 里同词不要重复记。）\n\n' + transcript
    }
    const raw = await compactCall({ system: EXPLORE_COMPACT_PROMPT, user: transcript })
    const parsed = parseCompactJson(raw)
    if (parsed === null) throw new Error('归档输出不是可解析的严格 JSON')
    let ids = []
    for (const w of parsed.weaknesses) {
      const saved = store.addWeakness({ subject: w.subject, node: w.node, quote: w.quote, src: 'conv:' + conv.id, source: 'explore' })
      if (saved !== null && !ids.includes(saved.id)) ids.push(saved.id)
    }
    const rec = store.saveExploration({ ...base, compact: parsed.compact, weaknessIds: ids })
    notify()
    pushItemTo(conv, { kind: 'notice', text: '📦 已归档 ' + rec.id + '：' + (ids.length > 0 ? '记下 ' + ids.length + ' 个待验证弱点' : '未采到新弱点') + '。原始对话仍在本会话里留档。' })
    return { ok: true, exploration: rec }
  } catch (err) {
    const msg = String(err && err.message ? err.message : err)
    const rec = store.saveExploration({ ...base, compact: null, degraded: true })
    notify()
    pushItemTo(conv, { kind: 'notice', text: '⚠ 归档失败（' + msg + '）：本轮降级为只存对话记录，弱点未入库。会话已解冻，可再点「❄ 这轮完了」重试。' })
    freezeConversation(convId, false)
    return { ok: false, degraded: true, error: msg, exploration: rec }
  }
}
