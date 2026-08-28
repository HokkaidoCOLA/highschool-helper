// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 极简 IndexedDB 键值层：Store 的持久化后端。没有 IDB（node 测试/隐私模式）时
 * 自动退化为内存 Map——数据仍然可用，只是不跨会话。
 *
 * 关键设计（真机数据丢失事故的教训）：写请求必须在 write() 的同一任务里同步派发。
 * 早期版本 idbSet 先 await open() 再开事务——window.alert 阻塞主线程时续体排队，
 * 进程被杀就丢数据。现在连接在 load() 阶段预热（prime），写入路径同步取用现成连接、
 * 立即 put——请求进入浏览器进程后，主线程再被弹窗阻塞也会照常提交。
 */

const memory = new Map()

/** @returns {boolean} 是否可用真实 IndexedDB。 */
export function idbAvailable() {
  return typeof indexedDB !== 'undefined'
}

let conn = null
let openPromise = null

function open() {
  if (openPromise === null) {
    openPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('hst-app', 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
        if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return openPromise
}

/** 预热连接（store.load() 内部调用；此后写路径不再 await open）。 */
export async function prime() {
  if (!idbAvailable()) return
  conn = await open()
}

/** 读全部文件。 @returns {Promise<Record<string,string>>} */
export async function idbGetAll() {
  if (!idbAvailable()) return Object.fromEntries(memory)
  await prime()
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('files', 'readonly')
    const out = {}
    tx.objectStore('files').openCursor().onsuccess = (ev) => {
      const cur = ev.target.result
      if (cur) { out[cur.key] = cur.value; cur.continue() } else resolve(out)
    }
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * 写一个文件。连接就绪时同步派发 put 请求（见文件头注释），返回提交 promise。
 * @param {string} name @param {string} value @returns {Promise<void>}
 */
export function idbSet(name, value) {
  if (!idbAvailable()) { memory.set(name, value); return Promise.resolve() }
  if (conn === null) {
    // 极早期写入（load 之前）：等连接就绪再派发，仍然不丢
    return open().then((db) => { conn = db; return putNow(name, value) })
  }
  return putNow(name, value)
}

function putNow(name, value) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('files', 'readwrite')
    tx.objectStore('files').put(value, name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** 删除一个文件（导入备份前的清理用）。 @param {string} name */
export function idbDel(name) {
  if (!idbAvailable()) { memory.delete(name); return Promise.resolve() }
  if (conn === null) return open().then((db) => { conn = db; return delNow(name) })
  return delNow(name)
}
function delNow(name) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('files', 'readwrite')
    tx.objectStore('files').delete(name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
// ── 会话存储（聊天侧边栏的多会话持久化；库版本 2 新增 conversations store）────
const memConvs = new Map()

/** 读全部会话。 @returns {Promise<Record<string,string>>} */
export async function convGetAll() {
  if (!idbAvailable()) return Object.fromEntries(memConvs)
  await prime()
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('conversations', 'readonly')
    const out = {}
    tx.objectStore('conversations').openCursor().onsuccess = (ev) => {
      const cur = ev.target.result
      if (cur) { out[cur.key] = cur.value; cur.continue() } else resolve(out)
    }
    tx.onerror = () => reject(tx.error)
  })
}

/** 写一个会话（同步派发，语义同 idbSet）。 */
export function convSet(id, text) {
  if (!idbAvailable()) { memConvs.set(id, text); return Promise.resolve() }
  if (conn === null) return open().then((db) => { conn = db; return convPutNow(id, text) })
  return convPutNow(id, text)
}
function convPutNow(id, text) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('conversations', 'readwrite')
    tx.objectStore('conversations').put(text, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** 删除一个会话。 */
export function convDel(id) {
  if (!idbAvailable()) { memConvs.delete(id); return Promise.resolve() }
  if (conn === null) return open().then((db) => { conn = db; return convDelNow(id) })
  return convDelNow(id)
}
function convDelNow(id) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('conversations', 'readwrite')
    tx.objectStore('conversations').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
