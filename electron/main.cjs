// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 高中助学 · Windows 桌面壳（Electron 主进程）。
 *
 * 设计：web 层（dist/）与安卓/PWA 完全同源、零改动；桌面差异全部由本壳补齐——
 *
 * 1. 资源加载：注册特权 `app://hst/` 协议从打包目录（asar 内的 dist/）直读，
 *    给 IndexedDB / localStorage 一个稳定安全源（origin = app://hst），
 *    数据落在 %APPDATA%\高中助学\，卸载重装不清库。
 * 2. AI 网络：安卓端靠 CapacitorHttp 绕 WebView CORS；这里由 preload 把页面里
 *    所有 http(s) fetch 透明转发到主进程 net.fetch（无 CORS 概念），带中止。
 * 3. 桌面习惯：原生菜单、输入框右键菜单、外链走系统浏览器、退出即销毁。
 *
 * 冒烟模式：HST_SMOKE=1 electron . ——隐藏窗口加载页面，探针验证渲染/桥接/IDB 后退出。
 */
const { app, BrowserWindow, Menu, MenuItem, protocol, net, ipcMain, shell, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

const SMOKE = process.env.HST_SMOKE === '1'
const APP_NAME = '高中助学'
app.setName(APP_NAME)

// ── 资源根目录（打包后在 asar 内；dev 在项目根）────────────────────────────
const DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'dist')
  : path.join(__dirname, '..', 'dist')

// app:// 必须是 standard + secure 才有正常的 origin/存储语义（ready 之前注册）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

/** asar 内静态文件服务：app://hst/<相对路径> → dist/<相对路径>。 */
function serveDist(reqUrl) {
  const u = new URL(reqUrl)
  let rel = decodeURIComponent(u.pathname)
  if (rel === '/' || rel === '') rel = '/index.html'
  const file = path.normalize(path.join(DIST, rel))
  // 路径穿越守卫：只允许 DIST 之内
  if (!file.startsWith(DIST + path.sep) && file !== DIST) return new Response('Forbidden', { status: 403 })
  try {
    const data = fs.readFileSync(file)
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
    return new Response(data, { headers: { 'content-type': type } })
  } catch {
    // SPA 兜底：未知路径回外壳（本应用单页，直接给 index.html）
    try {
      const html = fs.readFileSync(path.join(DIST, 'index.html'))
      return new Response(html, { headers: { 'content-type': MIME['.html'] } })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  }
}

// ── 原生 HTTP 代理（对齐 APK 的 CapacitorHttp 角色）────────────────────────
const inflight = new Map()
let httpSeq = 0

ipcMain.handle('hst:http', async (_evt, opts) => {
  const id = opts.id
  const ac = new AbortController()
  inflight.set(id, ac)
  try {
    const init = {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      signal: ac.signal,
    }
    if (opts.body != null) {
      init.body = typeof opts.body === 'string' ? Buffer.from(opts.body, 'utf8') : Buffer.from(opts.body)
    }
    const res = await net.fetch(opts.url, init)
    const body = Buffer.from(await res.arrayBuffer())
    const headers = {}
    res.headers.forEach((v, k) => { headers[k] = v })
    return { ok: true, status: res.status, statusText: res.statusText, headers, body }
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) }
  } finally {
    inflight.delete(id)
  }
})

ipcMain.on('hst:http:abort', (_evt, id) => {
  const ac = inflight.get(id)
  if (ac) ac.abort()
})

// 冒烟回报（渲染进程探针 → 主进程日志）
ipcMain.on('hst:smoke', (_evt, report) => {
  console.log('[smoke:renderer]', JSON.stringify(report))
})

// ── 窗口 ────────────────────────────────────────────────────────────────────
const ICON = path.join(__dirname, 'build', 'icon.ico')

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 880,
    minHeight: 560,
    show: false,
    title: APP_NAME,
    backgroundColor: '#eef3fb',
    autoHideMenuBar: true,
    icon: fs.existsSync(ICON) ? ICON : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: true,
    },
  })

  win.once('ready-to-show', () => { if (!SMOKE) win.show() })

  // 新窗口一律交给系统浏览器（App 自身不开子窗）
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // 应用外壳之外的一跳导航同样交给系统浏览器
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    }
  })

  if (SMOKE) runSmoke(win)
  win.loadURL('app://hst/index.html')
  return win
}

// ── 桌面右键菜单（输入框：剪切/复制/粘贴/全选）─────────────────────────────
function attachContextMenu(win) {
  win.webContents.on('context-menu', (_evt, params) => {
    const m = new Menu()
    const p = params
    if (p.isEditable) {
      m.append(new MenuItem({ role: 'cut', label: '剪切' }))
      m.append(new MenuItem({ role: 'copy', label: '复制' }))
      m.append(new MenuItem({ role: 'paste', label: '粘贴' }))
    } else if (p.selectionText) {
      m.append(new MenuItem({ role: 'copy', label: '复制' }))
    }
    if (p.mediaType === 'image') m.append(new MenuItem({ label: '复制图片', click: () => win.webContents.copyImageAt(p.x, p.y) }))
    if (m.items.length) {
      if (p.isEditable || p.selectionText || p.mediaType === 'image') m.append(new MenuItem({ type: 'separator' }))
      m.append(new MenuItem({ role: 'selectAll', label: '全选' }))
      m.popup({ window: win })
    }
  })
}

// ── 原生菜单 ────────────────────────────────────────────────────────────────
function buildMenu(getWin) {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开数据文件夹',
          click: () => shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { role: 'quit', label: '退出', accelerator: 'Ctrl+Q' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新', accelerator: 'Ctrl+R' },
        { role: 'forceReload', label: '强制刷新', accelerator: 'Ctrl+Shift+R' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小', accelerator: 'Ctrl+0' },
        { role: 'zoomIn', label: '放大', accelerator: 'Ctrl+Plus' },
        { role: 'zoomOut', label: '缩小', accelerator: 'Ctrl+-' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏', accelerator: 'F11' },
        {
          label: '开发者工具',
          accelerator: 'Ctrl+Shift+I',
          click: () => { const w = getWin(); if (w) w.webContents.toggleDevTools() },
        },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '项目主页（GitHub）',
          click: () => shell.openExternal('https://github.com/HokkaidoCOLA/dsh-highschool-tutor'),
        },
        {
          label: `关于 ${APP_NAME}`,
          click: () => {
            const { dialog } = require('electron')
            dialog.showMessageBox({
              type: 'info',
              title: APP_NAME,
              message: APP_NAME + ' v' + app.getVersion(),
              detail: '错题本 · 艾宾浩斯复习 · 动态演示 · 试卷导入 · AI 讲题\n数据全部保存在本机（' + app.getPath('userData') + '）\nGPL-3.0-or-later',
            })
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── 冒烟模式：验证「渲染 / 桥接 / 持久化 / 代理」四件套 ────────────────────
function runSmoke(win) {
  const deadline = setTimeout(() => {
    console.log('[smoke] FAIL: timeout')
    app.exit(2)
  }, 60000)
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.log('[smoke:console]', message)
  })
  win.webContents.once('did-finish-load', async () => {
    try {
      const report = await win.webContents.executeJavaScript(`(async () => {
        const t0 = Date.now()
        for (;;) {
          const root = document.getElementById('root')
          if (root && root.childElementCount > 0) break
          if (Date.now() - t0 > 25000) return { rendered: false }
          await new Promise((r) => setTimeout(r, 150))
        }
        let idb = false
        try {
          await new Promise((res, rej) => {
            const rq = indexedDB.open('hst-smoke', 1)
            rq.onsuccess = () => { rq.result.close(); res() }
            rq.onerror = () => rej(rq.error)
            rq.onupgradeneeded = () => rq.result.createObjectStore('probe')
          })
          idb = true
        } catch (e) { /* keep false */ }
        // 原生代理自检：对一个必然存在的公共端点发一次 GET（只看桥是否工作，不看内容）
        let proxy = false
        try {
          const r = await fetch('https://registry.npmjs.org/electron')
          proxy = r.status === 200
        } catch (e) { /* keep false */ }
        return {
          rendered: true,
          bridge: !!(window.__hstNative && typeof window.__hstNative.http === 'function'),
          patched: window.__hstFetchPatched === true,
          idb, proxy,
        }
      })()`, true)
      console.log('[smoke] report =', JSON.stringify(report))
      const ok = report && report.rendered && report.bridge && report.patched && report.idb && report.proxy
      console.log(ok ? '[smoke] PASS' : '[smoke] FAIL')
      clearTimeout(deadline)
      app.exit(ok ? 0 : 1)
    } catch (err) {
      console.log('[smoke] FAIL:', String(err && err.message || err))
      clearTimeout(deadline)
      app.exit(1)
    }
  })
}

// ── 启动 ────────────────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock && !SMOKE) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) { if (w.isMinimized()) w.restore(); w.focus() }
  })

  app.whenReady().then(() => {
    protocol.handle('app', (req) => serveDist(req.url))

    // 下载（备份导出等）保持系统默认「另存为」体验，仅统一权限姿态：拒绝摄像头/麦克风授权请求
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(permission === 'clipboard-sanitized-write' || permission === 'downloads-in-progress')
    })

    const win = createWindow()
    attachContextMenu(win)
    buildMenu(() => BrowserWindow.getAllWindows()[0] || win)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
