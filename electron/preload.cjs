// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 高中助学 · Windows 桌面壳（preload，sandbox 环境）。
 *
 * 职责只有一件事：让「同一份 web 产物」在桌面上也拥有安卓里 CapacitorHttp 的能力——
 * 在页面脚本之前把 window.fetch 中所有 http(s) 请求透明转发给主进程的 net.fetch
 * （主进程网络栈没有 CORS 概念），保持 Response/headers/abort 语义。web 层零改动。
 *
 * 另外：桌面上禁用 service worker 注册（资源随安装包整分发，无需缓存/OTA；
 * sw 在自定义协议下反而可能拖慢冷启动）。
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron')

contextBridge.exposeInMainWorld('__hstNative', {
  desktop: true,
  http: (opts) => ipcRenderer.invoke('hst:http', opts),
  abort: (id) => ipcRenderer.send('hst:http:abort', id),
})

// executeJavaScript 跑在「主世界」，与页面同一全局——这是唯一能改写页面 fetch 的合法入口
webFrame.executeJavaScript(`(() => {
  const N = window.__hstNative
  if (!N || !N.http || window.__hstFetchPatched) return
  window.__hstFetchPatched = true
  const orig = window.fetch.bind(window)
  let seq = 0
  window.fetch = async function (input, init) {
    init = init || {}
    let u = null
    try {
      u = new URL(typeof input === 'string' ? input : (input && input.url) ? input.url : String(input), location.href)
    } catch (e) { return orig(input, init) }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return orig(input, init)
    if (init.duplex) return orig(input, init) // 流式上传不走代理
    const headers = {}
    const h = init.headers
    if (h) {
      if (typeof h.append === 'function') h.forEach((v, k) => { headers[k] = headers[k] ? headers[k] + ', ' + v : v })
      else if (Array.isArray(h)) for (const p of h) headers[String(p[0])] = String(p[1])
      else for (const k of Object.keys(h)) headers[k] = String(h[k])
    }
    let body = init.body
    if (body != null && typeof body !== 'string') {
      body = await new Response(body).arrayBuffer().then((b) => new Uint8Array(b))
    }
    const id = ++seq
    const p = N.http({ id, url: u.href, method: String(init.method || 'GET').toUpperCase(), headers, body: body == null ? null : body })
    if (init.signal) {
      const onAbort = () => N.abort(id)
      if (init.signal.aborted) onAbort()
      else init.signal.addEventListener('abort', onAbort)
    }
    let r
    try { r = await p } catch (e) { throw new TypeError('Failed to fetch (desktop proxy): ' + e) }
    if (!r || !r.ok) throw new TypeError('Failed to fetch (desktop proxy): ' + ((r && r.error) || 'unknown'))
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers })
  }
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.register) {
      navigator.serviceWorker.register = () => Promise.reject(new Error('desktop: service worker disabled'))
    }
  } catch (e) {}
  console.log('[hst-desktop] fetch → native proxy ready')
})()`)
