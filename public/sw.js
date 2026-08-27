// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 极简离线优先 service worker：安装时预缓存外壳，运行时「同源 GET 缓存优先、
 * 网络兜底、离线回退外壳」。构建产物的文件名带内容哈希，外壳（index.html）走
 * 网络优先，从而发新包后自动更新；IndexedDB 数据完全在 SW 之外，互不影响。
 */
const VERSION = 'hst-app-v1'
const SHELL = new Set(['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'])

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // 跨源不接管（二期接 API 时保持直连）
  if (url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(VERSION).then((c) => c.put(req, copy))
        return res
      }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html'))),
    )
    return
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone()
      caches.open(VERSION).then((c) => c.put(req, copy))
      return res
    })),
  )
})
