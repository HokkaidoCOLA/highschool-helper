// SPDX-License-Identifier: GPL-3.0-or-later
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App.jsx'
import './app.css'
import { store } from './state.js'
import { loadConversations } from './ai/session.js'
import { watchViewport } from './ui/viewport.js'
import { initGlass } from './ui/glass.js'

watchViewport()
initGlass()

// 先水合数据再渲染：Store 的读取是同步接口（与插件版一致），load() 是唯一异步入口。
Promise.all([store.load(), loadConversations()]).then(
  () => createRoot(document.getElementById('root')).render(<App />),
  (err) => {
    document.getElementById('root').textContent = '数据初始化失败：' + String(err && err.message ? err.message : err)
  },
)

// PWA：注册 service worker（构建产物里才有 sw.js；dev 直连不缓存）。
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 离线增强失败不影响使用 */ })
  })
}