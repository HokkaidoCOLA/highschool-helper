// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 聊天会话管理（模块级单例）：多会话 + 持久化 + 切页不打断。
 *
 * 每个会话（conversation）自带：UI 消息流 items、模型上下文 apiMessages、
 * 标题、在途状态与 AbortController——A 会话回复中切到 B，A 的请求继续在后台
 * 跑完并写回 A 自己。会话整体存 IndexedDB（conversations store），重启不丢。
 *
 * getSession() 对活跃会话做投影（items/busy），组件用 useSyncExternalStore 订阅。
 */
import { store, notify } from '../state.js'
import { runAssistant } from './llm.js'
import { SUBJECT_PROMPTS } from '../core/prompts.js'
import { convGetAll, convSet, convDel } from '../core/idb.js'

let uid = 0
let convSeq = 0
const listeners = new Set()

let state = {
  convs: [],           // 会话数组，按 updatedAt 倒序
  activeId: null,
  items: [],           // 活跃会话投影
  busy: false,         // 活跃会话投影
  draftText: '',
  draftImages: [],
  loaded: false,
}

export function getSession() {
  return state
}

export function subscribeSession(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  const c = activeConv()
  state = { ...state, items: c === null ? [] : c.items, busy: c !== null && c.busy === true }
  for (const fn of [...listeners]) {
    try { fn() } catch { /* 订阅者异常不断广播 */ }
  }
}

function activeConv() {
  return state.convs.find((c) => c.id === state.activeId) ?? null
}

/** 持久化（防抖 500ms；写请求本身同步派发，不怕随后被弹窗阻塞） */
const saveTimers = new Map()
function persist(c) {
  if (c === null || state.loaded !== true) return
  // 已删除的会话不回写：删除在途会话时，abort 触发的收尾 pushItemTo 会带着
  // 旧引用回到这里——不拦住就会把刚 convDel 掉的记录重新写进 IDB（重启复活）。
  if (!state.convs.some((x) => x.id === c.id)) return
  clearTimeout(saveTimers.get(c.id) ?? 0)
  saveTimers.set(c.id, setTimeout(() => {
    if (!state.convs.some((x) => x.id === c.id)) { saveTimers.delete(c.id); return } // 防抖窗口内被删也要复查
    const slim = {
      id: c.id, title: c.title, subject: c.subject, createdAt: c.createdAt, updatedAt: c.updatedAt,
      // 双环四库（M1）字段：删了会「重启丢分支」——见本文件「删了又复活」注释的历史教训，
      // 新字段必须三处同步：创建 / 这里 / loadConversations。
      kind: c.kind === 'exploration' ? 'exploration' : 'chat',
      parentId: typeof c.parentId === 'string' ? c.parentId : null,
      forkFrom: c.forkFrom !== null && typeof c.forkFrom === 'object' ? c.forkFrom : null,
      gen: Number.isFinite(c.gen) ? Math.trunc(c.gen) : 0,
      frozen: c.frozen === true,
      fromExploration: typeof c.fromExploration === 'string' ? c.fromExploration : null,
      exploreTerm: typeof c.exploreTerm === 'object' && c.exploreTerm !== null && typeof c.exploreTerm.term === 'string' && c.exploreTerm.term !== ''     ? { term: String(c.exploreTerm.term).slice(0, 40), quote: String(c.exploreTerm.quote || '').slice(0, 300), msgId: c.exploreTerm.msgId ?? null }     : null,
      items: c.items, apiMessages: c.apiMessages,
    }
    convSet(c.id, JSON.stringify(slim)).catch(() => {})
  }, 500))
}

function sortByUpdated() {
  state.convs.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 启动加载（main.jsx 在渲染前 await）。无历史则建一个新会话。 */
export async function loadConversations() {
  const all = await convGetAll()
  const convs = []
  for (const raw of Object.values(all)) {
    try {
      const c = JSON.parse(raw)
      if (typeof c !== 'object' || c === null || typeof c.id !== 'string') continue
      convs.push({
        id: c.id, title: String(c.title || '新对话'),
        createdAt: Number(c.createdAt) || Date.now(), updatedAt: Number(c.updatedAt) || Date.now(),
        subject: SUBJECT_PROMPTS[c.subject] !== undefined || c.subject === 'auto' ? c.subject : 'auto',
        kind: c.kind === 'exploration' ? 'exploration' : 'chat',
        parentId: typeof c.parentId === 'string' ? c.parentId : null,
        forkFrom: c.forkFrom !== null && typeof c.forkFrom === 'object' ? c.forkFrom : null,
        gen: Number.isFinite(c.gen) ? Math.max(0, Math.trunc(c.gen)) : 0,
        frozen: c.frozen === true,
        fromExploration: typeof c.fromExploration === 'string' ? c.fromExploration : null,
        exploreTerm: typeof c.exploreTerm === 'object' && c.exploreTerm !== null && typeof c.exploreTerm.term === 'string' && c.exploreTerm.term !== ''
        ? { term: String(c.exploreTerm.term).slice(0, 40), quote: String(c.exploreTerm.quote || '').slice(0, 300), msgId: c.exploreTerm.msgId ?? null }
        : null,
        items: Array.isArray(c.items) ? c.items : [],
        apiMessages: Array.isArray(c.apiMessages) ? c.apiMessages : [],
        busy: false, abort: null,
      })
    } catch { /* 坏记录跳过 */ }
  }
  convs.sort((a, b) => b.updatedAt - a.updatedAt)
  state = { ...state, convs, loaded: true }
  if (convs.length === 0) {
    newConversation()
  } else {
    state = { ...state, activeId: convs[0].id }
    emit()
  }
  return state
}

/** 新建会话并切过去。 */
export function newConversation() {
  convSeq += 1
  const c = {
    id: 'cv_' + Date.now().toString(36) + '_' + convSeq,
    title: '新对话', createdAt: Date.now(), updatedAt: Date.now(),
    items: [], apiMessages: [], subject: 'auto', busy: false, abort: null,
    kind: 'chat', parentId: null, forkFrom: null, gen: 0, frozen: false, fromExploration: null, exploreTerm: null,
  }
  state = { ...state, convs: [c, ...state.convs], activeId: c.id }
  emit()
  return c
}

/** 按 id 取会话（explore.js 冻结归档时用）。 */
export function getConversation(id) {
  return state.convs.find((c) => c.id === id) ?? null
}

/**
 * 上下文前缀守卫：assistant 带 tool_calls 却没有配齐 tool 响应的前缀会让
 * OpenAI 兼容端点 400 拒收（会话永久坏掉，见 llm.js MAX_TOOL_ROUNDS 注释）。
 * 从尾部裁到配对完整为止（tool 响应总在其 assistant 之后，裁 assistant 即连带裁掉散尾 tool 行）。
 */
function trimToPairedContext(msgs) {
  const list = msgs.slice()
  for (;;) {
    const provided = new Set()
    for (const m of list) if (m.role === 'tool' && typeof m.tool_call_id === 'string') provided.add(m.tool_call_id)
    let dangling = -1
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const calls = Array.isArray(list[i].tool_calls) ? list[i].tool_calls : []
      if (list[i].role === 'assistant' && calls.length > 0 && calls.some((c) => c === null || typeof c !== 'object' || !provided.has(c.id))) { dangling = i; break }
    }
    if (dangling < 0) break
    list.length = dangling
  }
  return list.map((m) => ({ ...m }))
}

/**
 * 从某条消息处分叉出探索会话（B 环入口，06 篇 §2-B）。
 * 复制 items 前缀（含该条）与 apiMessages 的**完整回合**前缀——截断点取消息行上
 * pushItemTo 记录的 apiLen（老记录没有就向前找最近的；再没有则空上下文，只留转写）。
 * @param {string} convId 母会话 id
 * @param {number|string} itemId 母会话中的消息 id
 * @param {object} [anchor] { term, quote }——词条级探索（v0.2.1，参考 Explore 的
 *   「点不懂的词→开子卡片」）：给锚点时会话以词条为题、只围绕该词；不给则整条消息兜底。
 * @returns {object|null} 新会话；分叉点不存在时 null
 */
export function forkConversation(convId, itemId, anchor) {
  const parent = state.convs.find((x) => x.id === convId)
  if (parent === undefined || parent === null) return null
  const idx = parent.items.findIndex((it) => it.id === itemId)
  if (idx < 0) return null
  let apiLen = -1
  for (let i = idx; i >= 0; i -= 1) {
    if (Number.isFinite(parent.items[i].apiLen)) { apiLen = parent.items[i].apiLen; break }
  }
  if (apiLen < 0) apiLen = 0
  // 净口径截断：剥掉 runAssistant 塞在最前的 system 头（子会话下一轮会按自己学科重建），
  // 再按 pushItemTo 记的净长度取前缀——两边同一把尺，回合边界才不会错一格。
  const net = parent.apiMessages.length > 0 && parent.apiMessages[0].role === 'system'
    ? parent.apiMessages.slice(1) : parent.apiMessages
  apiLen = Math.min(Math.max(0, Math.trunc(apiLen)), net.length)
  convSeq += 1
  const siblings = state.convs.filter((x) => x.parentId === parent.id).length
  const term = anchor !== null && typeof anchor === 'object' && typeof anchor.term === 'string' && anchor.term.trim() !== ''
    ? anchor.term.trim().slice(0, 40) : null
  const c = {
    id: 'cv_' + Date.now().toString(36) + '_' + convSeq,
    title: term !== null ? term : String(parent.title || '新对话').slice(0, 14) + ' · 探索 ' + (siblings + 1),
    createdAt: Date.now(), updatedAt: Date.now(),
    subject: parent.subject,
    kind: 'exploration', parentId: parent.id,
    forkFrom: { itemId, index: idx }, gen: (Number.isFinite(parent.gen) ? parent.gen : 0) + 1,
    frozen: false,
    exploreTerm: term === null ? null : { term, quote: String(anchor.quote || '').slice(0, 300), msgId: itemId },
    items: parent.items.slice(0, idx + 1).map((it) => ({ ...it })),
    apiMessages: trimToPairedContext(net.slice(0, apiLen)),
    busy: false, abort: null,
  }
  state = { ...state, convs: [c, ...state.convs], activeId: c.id }
  emit()
  persist(c)
  return c
}

/**
 * 冻结/解冻会话（D4：「这轮完了」由用户点；冻结是封口动作，
 * 四件套归档在 src/ai/explore.js 完成）。frozen 会话 sendUser 拒发。
 */
export function freezeConversation(id, frozen = true) {
  const c = state.convs.find((x) => x.id === id)
  if (c === undefined || c === null) return null
  c.frozen = frozen === true
  c.updatedAt = Date.now()
  persist(c)
  emit()
  return c
}

/**
 * 从 B₂ 档案复活第二代探索（M4 · tutor_explore.resume 的会话层动作）：
 * 新会话挂在冻结的第一代之下（森林按代际分层），**不重放 transcript**——
 * 四件套经 fromExploration 在每次发送时注入 system（archiveLines），聊的是继承。
 * @param {string} parentConvId 冻结的第一代会话 id。
 * @param {string} explorationId 档案 id（explorations.json）。
 * @returns {object|null} 新会话；母会话不存在时 null。
 */
export function resumeFromExploration(parentConvId, explorationId) {
  const parent = state.convs.find((x) => x.id === parentConvId)
  if (parent === undefined || parent === null) return null
  convSeq += 1
  const siblings = state.convs.filter((x) => x.parentId === parent.id).length
  const c = {
    id: 'cv_' + Date.now().toString(36) + '_' + convSeq,
    title: String(parent.title || '探索').slice(0, 16) + (siblings > 0 ? ' · 再探 ' + (siblings + 1) : ' · 第二代'),
    createdAt: Date.now(), updatedAt: Date.now(),
    subject: parent.subject,
    kind: 'exploration', parentId: parent.id,
    forkFrom: { explorationId, fromArchive: true },
    gen: (Number.isFinite(parent.gen) ? parent.gen : 0) + 1,
    frozen: false, fromExploration: explorationId,
    exploreTerm: parent.exploreTerm !== null && typeof parent.exploreTerm === 'object' ? { ...parent.exploreTerm } : null,
    items: [{ id: ++uid, kind: 'notice', apiLen: 0, text: '🌱 第二代探索：从档案 ' + explorationId + ' 继承（四件套注入 system，不重放上一轮对话）。' }],
    apiMessages: [],
    busy: false, abort: null,
  }
  state = { ...state, convs: [c, ...state.convs], activeId: c.id }
  emit()
  persist(c)
  return c
}

/** 会话 → 注入用档案视图（四件套 + 弱点节点现状；M4 archiveLines 的数据源）。 */
export function archiveView(conv) {
  if (conv === null || conv === undefined || typeof conv.fromExploration !== 'string' || conv.fromExploration === '') return null
  const rec = store.getExploration(conv.fromExploration)
  if (rec === null || rec === undefined) return null
  const weaknessNodes = (rec.weaknessIds || []).map((id) => {
    const w = store.getWeakness(id)
    if (w === null || w === undefined) return null
    return w.node + '[' + w.status + ']'
  }).filter((x) => x !== null)
  const c = rec.compact
  return {
    degraded: rec.degraded === true || c === null,
    conclusion: c ? c.conclusion : '',
    stuckReplay: c ? c.stuckReplay : '',
    chain: c ? c.chain : [],
    openBranches: c ? c.openBranches : [],
    weaknessNodes,
  }
}

export function switchConversation(id) {
  if (state.convs.some((c) => c.id === id)) {
    state = { ...state, activeId: id }
    emit()
  }
}

export function renameConversation(id, title) {
  const c = state.convs.find((x) => x.id === id)
  if (c !== undefined && typeof title === 'string') {
    c.title = title.trim().slice(0, 30) || c.title
    c.updatedAt = Date.now()
    sortByUpdated()
    persist(c)
    emit()
  }
}

/** 删除会话（在途请求先中止）；删掉活跃会话则自动切到下一个或新建。 */
/** 锁定/解锁会话学科：auto 或六科键。下一轮对话即刻生效。 */
export function setConversationSubject(id, subject) {
  const c = state.convs.find((x) => x.id === id)
  if (c !== undefined && (subject === 'auto' || SUBJECT_PROMPTS[subject] !== undefined)) {
    c.subject = subject
    c.updatedAt = Date.now()
    persist(c)
    emit()
  }
}

export function deleteConversation(id) {
  const idx = state.convs.findIndex((c) => c.id === id)
  if (idx < 0) return
  const c = state.convs[idx]
  if (c.abort !== null) { try { c.abort.abort() } catch { /* 忽略 */ } }
  state.convs.splice(idx, 1)
  convDel(id).catch(() => {})
  if (state.convs.length === 0) {
    state = { ...state, activeId: null }
    newConversation()
    return
  }
  if (state.activeId === id) state = { ...state, activeId: state.convs[0].id }
  emit()
}

export function setDraftText(v) {
  state = { ...state, draftText: v }
  emit()
}

export function addDraftImage(url) {
  if (state.draftImages.length >= 4) return
  state = { ...state, draftImages: state.draftImages.concat([url]) }
  emit()
}

export function removeDraftImage(i) {
  state = { ...state, draftImages: state.draftImages.filter((_, j) => j !== i) }
  emit()
}

/** 模型上下文的「净长度」：runAssistant 每轮临时 unshift 的 system 头不算对话内容。 */
function netApiLen(conv) {
  const arr = Array.isArray(conv.apiMessages) ? conv.apiMessages : []
  return arr.length - (arr.length > 0 && arr[0] && arr[0].role === 'system' ? 1 : 0)
}

/** 往指定会话追加一条消息（工具事件写回发起会话，而非当前活跃会话）。 */
export function pushItemTo(conv, it) {
  if (conv === null || conv === undefined) return
  // apiLen：这条消息落地时上下文的净长度（不含 system 头）——forkConversation 靠它
  // 把 apiMessages 截到同样的回合边界（user 行在 push 用户 api 消息之后才落，见 sendUser）。
  const marked = { id: ++uid, apiLen: netApiLen(conv), ...it }
  conv.items = conv.items.concat([marked])
  conv.updatedAt = Date.now()
  sortByUpdated()
  persist(conv)
  emit()
}

export function pushItem(it) {
  pushItemTo(activeConv(), it)
}

function onToolEvent(conv, ev) {
  if (ev.phase !== 'done') return
  if (ev.ok && ev.meta && ev.meta.kind === 'hst-demo') { pushItemTo(conv, { kind: 'demo', meta: ev.meta }); return }
  if (ev.ok && ev.meta && ev.meta.kind === 'hst-deck') { pushItemTo(conv, { kind: 'deck', cards: ev.meta.items || [] }); return }
  pushItemTo(conv, { kind: 'tool', label: ev.label, ok: ev.ok, error: ev.error })
}

/**
 * 在活跃会话发送一条用户消息并驱动整个回合（多轮工具循环）。
 * 切页/切会话都不影响执行；promise 仅供需要 await 的调用方（测试）。
 */
export function sendUser(text, images) {
  const conv = activeConv()
  if (conv === null || conv.busy) return Promise.resolve()
  if (conv.frozen === true) {
    pushItemTo(conv, { kind: 'notice', text: '❄ 本轮探索已冻结归档。想继续聊，可从任意消息分叉条新探索（🌱）' })
    return Promise.resolve()
  }
  const imgs = images || []
  if (conv.title === '新对话' && text.trim() !== '') conv.title = text.trim().slice(0, 18)
  conv.busy = true
  conv.apiMessages.push({
    role: 'user',
    content: imgs.length > 0
      ? [{ type: 'text', text: text || '请识别这张图片里的题目并讲解。' }].concat(imgs.map((url) => ({ type: 'image_url', image_url: { url } })))
      : text,
  })
  // 用户 api 消息先入列再落 UI 行：该行记到的 apiLen 才包含自己（fork 在这里续聊要带着它）
  pushItemTo(conv, { kind: 'user', text, images: imgs })
  state = { ...state, draftText: '', draftImages: [] }
  const ctrl = new AbortController()
  conv.abort = ctrl
  emit()
  return runAssistant(conv.apiMessages, (ev) => onToolEvent(conv, ev), ctrl.signal, { subject: conv.subject, archive: archiveView(conv), term: conv.exploreTerm || null }).then(
    (final) => {
      if (final) pushItemTo(conv, { kind: 'assistant', text: final })
      notify()
    },
    (err) => {
      // 用户点「停止」→ fetch 半途 abort 抛的是 DOMException（AbortError: signal is aborted…），
      // 不该以红色错误气泡示人，按正常「已停止」处理
      if (ctrl.signal.aborted) pushItemTo(conv, { kind: 'notice', text: '已停止' })
      else pushItemTo(conv, { kind: 'error', text: String(err && err.message ? err.message : err) })
      notify()
    },
  ).finally(() => {
    conv.busy = false
    conv.abort = null
    persist(conv)
    emit()
  })
}

/** 停止活跃会话的在途请求。 */
export function stopUser() {
  const conv = activeConv()
  if (conv !== null && conv.abort !== null) { try { conv.abort.abort() } catch { /* 忽略 */ } }
}

/** 清空活跃会话的消息与上下文（会话本身保留）。 */
export function clearSession() {
  const conv = activeConv()
  if (conv === null) return
  stopUser()
  conv.items = []
  conv.apiMessages = []
  conv.title = '新对话'
  conv.updatedAt = Date.now()
  state = { ...state, draftText: '', draftImages: [] }
  persist(conv)
  emit()
}