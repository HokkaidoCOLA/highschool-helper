// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 聊天会话（模块级单例）：消息流、模型上下文、在途请求都活在这里，
 * 不随页面组件卸载——切到别的标签页，请求继续在后台跑完（工具照常落库、
 * 排期照常写入），切回来历史与「输入中」状态原样还在。
 * 只有用户显式按「停止」或「新会话」才会中断/清空。
 */
import { store, notify } from '../state.js'
import { runAssistant } from './llm.js'

let uid = 0
let apiMessages = []
let abortCtrl = null
const listeners = new Set()

let state = {
  items: [],          // 界面消息流（user/assistant/tool/demo/deck/file/error/notice）
  busy: false,        // 有请求在途
  draftText: '',      // 输入框草稿（切页不丢）
  draftImages: [],    // 待发送的图片 dataURL
}

export function getSession() {
  return state
}

export function subscribeSession(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function patch(next) {
  state = { ...state, ...next }
  for (const fn of [...listeners]) {
    try { fn() } catch { /* 订阅者异常不断广播 */ }
  }
}

/** 往消息流追加一条（自动补 id）。 */
export function pushItem(it) {
  patch({ items: state.items.concat([{ id: ++uid, ...it }]) })
}

export function setDraftText(v) {
  patch({ draftText: v })
}

export function addDraftImage(url) {
  if (state.draftImages.length >= 4) return
  patch({ draftImages: state.draftImages.concat([url]) })
}

export function removeDraftImage(i) {
  patch({ draftImages: state.draftImages.filter((_, j) => j !== i) })
}

/** 工具完成事件 → 消息流卡片（演示卡/翻卡组/过程行）。 */
function onToolEvent(ev) {
  if (ev.phase !== 'done') return
  if (ev.ok && ev.meta && ev.meta.kind === 'hst-demo') { pushItem({ kind: 'demo', meta: ev.meta }); return }
  if (ev.ok && ev.meta && ev.meta.kind === 'hst-deck') { pushItem({ kind: 'deck', cards: ev.meta.items || [] }); return }
  pushItem({ kind: 'tool', label: ev.label, ok: ev.ok, error: ev.error })
}

/**
 * 发送一条用户消息并驱动整个回合（含多轮工具调用）。
 * 切页不影响执行；返回 promise 仅供需要 await 的调用方（测试）使用。
 */
export function sendUser(text, images) {
  if (state.busy) return Promise.resolve()
  const imgs = images || []
  pushItem({ kind: 'user', text, images: imgs })
  patch({ busy: true, draftText: '', draftImages: [] })
  apiMessages.push({
    role: 'user',
    content: imgs.length > 0
      ? [{ type: 'text', text: text || '请识别这张图片里的题目并讲解。' }].concat(imgs.map((url) => ({ type: 'image_url', image_url: { url } })))
      : text,
  })
  abortCtrl = new AbortController()
  return runAssistant(apiMessages, onToolEvent, abortCtrl.signal).then(
    (final) => {
      if (final) pushItem({ kind: 'assistant', text: final })
      notify()
    },
    (err) => {
      pushItem({ kind: 'error', text: String(err && err.message ? err.message : err) })
      notify()
    },
  ).finally(() => {
    abortCtrl = null
    patch({ busy: false })
  })
}

/** 显式停止在途请求（界面上的 ■）。 */
export function stopUser() {
  if (abortCtrl !== null) abortCtrl.abort()
}

/** 新会话：清空消息流与模型上下文（在途请求先停止）。 */
export function clearSession() {
  stopUser()
  apiMessages = []
  patch({ items: [], draftText: '', draftImages: [] })
}
