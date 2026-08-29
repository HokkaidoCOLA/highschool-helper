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
  }
  state = { ...state, convs: [c, ...state.convs], activeId: c.id }
  emit()
  return c
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

/** 往指定会话追加一条消息（工具事件写回发起会话，而非当前活跃会话）。 */
export function pushItemTo(conv, it) {
  if (conv === null || conv === undefined) return
  conv.items = conv.items.concat([{ id: ++uid, ...it }])
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
  const imgs = images || []
  if (conv.title === '新对话' && text.trim() !== '') conv.title = text.trim().slice(0, 18)
  conv.busy = true
  pushItemTo(conv, { kind: 'user', text, images: imgs })
  state = { ...state, draftText: '', draftImages: [] }
  conv.apiMessages.push({
    role: 'user',
    content: imgs.length > 0
      ? [{ type: 'text', text: text || '请识别这张图片里的题目并讲解。' }].concat(imgs.map((url) => ({ type: 'image_url', image_url: { url } })))
      : text,
  })
  const ctrl = new AbortController()
  conv.abort = ctrl
  emit()
  return runAssistant(conv.apiMessages, (ev) => onToolEvent(conv, ev), ctrl.signal, { subject: conv.subject }).then(
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