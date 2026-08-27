// SPDX-License-Identifier: GPL-3.0-or-later
// 极简 IndexedDB 键值层：Store 的持久化后端。没有 IDB（node 测试/隐私模式）时
// 自动退化为内存 Map——数据仍然可用，只是不跨会话。

const memory = new Map()

/** @returns {boolean} 是否可用真实 IndexedDB。 */
export function idbAvailable() {
  return typeof indexedDB !== 'undefined'
}

let dbPromise = null
function open() {
  if (dbPromise === null) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('hst-app', 1)
      req.onupgradeneeded = () => { req.result.createObjectStore('files') }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

/** 读全部文件。 @returns {Promise<Record<string,string>>} */
export async function idbGetAll() {
  if (!idbAvailable()) return Object.fromEntries(memory)
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly')
    const out = {}
    tx.objectStore('files').openCursor().onsuccess = (ev) => {
      const cur = ev.target.result
      if (cur) { out[cur.key] = cur.value; cur.continue() } else resolve(out)
    }
    tx.onerror = () => reject(tx.error)
  })
}

/** 写一个文件。 @param {string} name @param {string} value @returns {Promise<void>} */
export async function idbSet(name, value) {
  if (!idbAvailable()) { memory.set(name, value); return }
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite')
    tx.objectStore('files').put(value, name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 删除一个文件（导入备份前的清理用）。 @param {string} name */
export async function idbDel(name) {
  if (!idbAvailable()) { memory.delete(name); return }
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite')
    tx.objectStore('files').delete(name)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
