// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 生成 v0.1.1 版本发布演示 PPT（渲染逻辑见 scripts/ppt-lib.mjs）。
 * 用法：node scripts/make-ppt.mjs            → 高中助学-v0.1.1-版本发布.pptx
 *       node scripts/make-ppt.mjs --preview  → .cache/ppt-preview.html
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BRAND, PURPLE, DEEP, INK, INK2, SOFT, CARD, LINE, OK, WARN, RED,
  M, CW, TOP, BOT, HALF, X2, PIC_W, PIC_X, PIC_Y, AR, CAR,
  rect, text, pic, table, B, blist, bg, icon, chrome,
  renderPptx, renderPreview,
} from './ppt-lib.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOT = (f) => resolve(ROOT, '.preview/desktop', f)
const VIZ = (f) => resolve(ROOT, '.preview/viz', f)
const OUT = resolve(ROOT, '高中助学-v0.1.1-版本发布.pptx')
const FOOTER = '高中助学 · v0.1.1 版本发布'

/* ── 十二页版式 ─────────────────────────────────────────────────────────── */
const SLIDES = []

/* S1 封面 */
SLIDES.push([
  bg(BRAND),
  rect(8.6, -1.7, 7.0, 7.0, PURPLE, { t: 45, r: 1.5 }),
  rect(-1.9, 4.7, 6.2, 6.2, DEEP, { t: 55, r: 1.5 }),
  icon(resolve(ROOT, 'public/icons/icon-512.png'), 1.12, 1.12, 0.92, { chip: true }),
  text(1.02, 0.66, 10.5, 0.32, 'RELEASE · 2026-08 · 语 数 英 物 化 地', { size: 10.5, color: SOFT, spacing: 3 }),
  text(2.42, 0.98, 9.6, 0.92, '高中助学', { size: 40, bold: true, color: CARD, spacing: 4, valign: 'middle' }),
  text(2.46, 1.98, 10.2, 0.52, 'v0.1.1 版本发布 · Windows 原生版来了', { size: 18, color: SOFT }),
  rect(1.02, 3.28, 11.3, 2.42, CARD, { t: 88, r: 0.16 }),
  text(1.42, 3.62, 10.6, 0.56, '错题本 × 艾宾浩斯复习 × 二维/三维动态演示 × AI 讲题', { size: 17, bold: true, color: CARD }),
  text(1.42, 4.32, 10.6, 0.44, [{ lead: '三端同源：', leadColor: CARD, soft: true, text: 'Android APK（已发布）· Windows 桌面（本版新增）· PWA（零安装）' }], { size: 13 }),
  text(1.42, 4.92, 10.6, 0.44, '离线是默认状态，不是降级 —— 数据全部保存在本机，API Key 不出设置页', { size: 12, color: 'BFD3FF' }),
  text(1.02, 6.62, 11.3, 0.4, 'GPL-3.0-or-later · 与 DSH 插件 dsh-highschool-tutor 引擎字节级同源', { size: 11, color: 'BFD3FF' }),
])

/* S2 它解决什么 */
SLIDES.push([
  ...chrome('它解决什么：四个「凭感觉」→ 四个「有依据」', '定位'),
  rect(M, TOP, HALF, 4.62, CARD, { line: LINE, shadow: true }),
  text(M + 0.3, TOP + 0.22, HALF - 0.6, 0.42, '学生的一天', { size: 15, bold: true, color: RED }),
  blist(M + 0.3, TOP + 0.78, HALF - 0.6, 3.7, [
    B('复习凭感觉：', '错过的题下次还错，会做的题越放越生'),
    B('错题四散：', '照片、纸条、教辅页……想复习时找不到'),
    B('难题看不见：', '受力分析、立体几何、晶胞、晨昏线只能脑补'),
    B('录入手工苦：', '一晚上抄 20 道错题，抄完也累了'),
  ], { size: 12.5 }),
  rect(X2, TOP, HALF, 4.62, CARD, { line: LINE, shadow: true }),
  text(X2 + 0.3, TOP + 0.22, HALF - 0.6, 0.42, 'App 的答案', { size: 15, bold: true, color: OK }),
  blist(X2 + 0.3, TOP + 0.78, HALF - 0.6, 3.7, [
    B('艾宾浩斯排期：', '入队即进遗忘曲线，答错 20 分钟后重排队'),
    B('一个题库收口：', '拍照录题 / 拖入整份试卷自动切题回填答案'),
    B('九种 2D/3D 场景：', '按讲解节奏逐步「长出来」的分步演示图'),
    B('AI 教练内置：', '讲题、画图、抽查、排计划——14 个工具真实落库'),
  ], { size: 12.5 }),
  text(M, 6.32, CW, 0.42, '六科覆盖：语 · 数 · 英 · 物 · 化 · 地（人教版新教材口径，考区可配）', { size: 12, color: INK2, align: 'center' }),
])

/* S3 八页闭环 */
SLIDES.push([
  ...chrome('八个页面 = 一套学习闭环', '导览'),
  ...[
    ['聊天', 'AI 教练主页：拍照讲题、拖卷入库、说「抽查我」', BRAND],
    ['今日', '高考倒计时 · 今日队列 · 分科待复习 · 快速记一笔', PURPLE],
    ['复习', '翻卡四档评分，左演示画布右卡片，进度即时回写', OK],
    ['题库', '检索 / 薄弱筛选 / Markdown 导出，错题卡片化管理', '0E8F86'],
    ['演示', '9 场景样例 + 六科完整讲题卡 + 对话实时生成', WARN],
    ['资料', '电子试卷/课件导入：自动切题 + 答案回填', 'C0392B'],
    ['统计', '复习曲线 · 掌握度 · 记忆保持率 · 模考趋势', '5B6EF0'],
    ['设置', 'AI 接入 · 学情设置 · 备份与插件数据迁移', '7A828E'],
  ].map((p, i) => {
    const w = (CW - 3 * 0.18) / 4, x = M + (i % 4) * (w + 0.18), y = TOP + Math.floor(i / 4) * 2.18
    return [
      rect(x, y, w, 2.0, CARD, { line: LINE, shadow: true }),
      rect(x + 0.22, y + 0.24, 0.5, 0.13, p[2], { r: 0.065 }),
      text(x + 0.2, y + 0.46, w - 0.4, 0.44, p[0], { size: 16, bold: true }),
      text(x + 0.2, y + 0.94, w - 0.38, 0.98, p[1], { size: 10, color: INK2, lh: 1.25 }),
    ]
  }).flat(),
  text(M, 6.14, CW, 0.5, '不接模型时，它依然是完整的「复习 / 题库 / 演示 / 资料 / 统计」工具——AI 是增强，不是前提', { size: 13, bold: true, color: BRAND, align: 'center' }),
])

/* S4 AI 聊天（左文右图标准版式） */
SLIDES.push([
  ...chrome('AI 对话内置：聊天就是主页', '核心能力 ①'),
  blist(M, TOP + 0.12, 4.95, 5.3, [
    B('拍照/相册发题：', '视觉模型识别题干，直接进讲题流程'),
    B('📎 拖入整份试卷：', 'docx / pptx / csv / html 自动切题、识别 ABCD、答案按题号回填'),
    B('模型画图：', '对话里生成可分步演示的讲题卡，落进演示库'),
    B('「抽查我」：', '当场翻卡、四档评分、推进排期'),
    B('14 个工具协议：', '与 DSH 插件同款——模型是大脑，执行全在本机题库'),
    B('凭证自备：', '任意 OpenAI 兼容端点，Key 只存本机'),
  ], { size: 12 }),
  pic(SHOT('a-chat.png'), PIC_X, PIC_Y, PIC_W, { cap: '1240×820 桌面实拍：侧栏常驻 · 建议气泡 · 玻璃 Dock' }),
])

/* S5 招牌：发一道题 → 长出一张会动的图（分步时间轴实拍） */
{
  const cw = (CW - 3 * 0.18) / 4
  const heads = [
    ['① 发题', '拍照 / 文字 / 整份试卷'],
    ['② 生成', '模型调用 tutor_visualize 写 scene 规范'],
    ['③ 分步推进', 'show / hide / focus，★ 关键步骤'],
    ['④ 沉淀复用', '落演示库，复习翻卡再打开'],
  ]
  SLIDES.push([
    ...chrome('发一道题，长出一张会动的图', '招牌能力 ①'),
    ...heads.map(([h, d], i) => text(M + i * (cw + 0.18), 1.42, cw, 1.0, [
      { lead: h + '　', text: d },
    ], { size: 10.5, lh: 1.2 })),
    ...['v-step1', 'v-step2', 'v-step3', 'v-step4'].map((f, i) =>
      pic(VIZ(f + '.png'), M + i * (cw + 0.18), 2.62, cw, { ar: CAR, cap: ['第 1 步 · 只画重力', '第 2 步 · 弹力与摩擦', '第 3 步 · 力的分解', '第 4 步 · 列方程 ★'][i] })),
    text(M, 5.72, CW, 0.4, '同一道斜面题，从「只有重力」到「列出方程」——图跟着讲解节奏一步步长出来', { size: 12.5, bold: true, color: BRAND, align: 'center' }),
    text(M, 6.22, CW, 0.4, '内置 9+7 份样例 · 对话实时生成 · JSON 导入——引擎与 DSH 插件字节级同源', { size: 11.5, color: INK2, align: 'center' }),
  ])
}

/* S6 招牌：二维场景 */
{
  const cw = (CW - 2 * 0.24) / 3
  SLIDES.push([
    ...chrome('二维：函数切线、电路、过程曲线', '招牌能力 ②'),
    pic(VIZ('v-plot2d.png'), M, 1.38, cw, { ar: CAR, cap: 'plot2d · 导数的几何意义：x=1 处的切线' }),
    pic(VIZ('v-circuit.png'), M + cw + 0.24, 1.38, cw, { ar: CAR, cap: 'circuit · 滑动变阻器对电路的影响' }),
    pic(VIZ('v-chart2d.png'), M + 2 * (cw + 0.24), 1.38, cw, { ar: CAR, cap: 'chart2d · 升温对化学平衡的影响（v−t）' }),
    blist(M, 5.0, HALF, 1.9, [
      B('数学 / 物理：', '函数图像与切线、受力与运动（mech2d）、电路分步变换'),
      B('化学 / 地理：', '平衡移动、滴定、气候等过程曲线（chart2d）'),
    ], { size: 11.5 }),
    blist(X2, 5.0, HALF, 1.9, [
      B('diagram2d：', '工业制硫酸等流程示意图，步骤高亮推进'),
      B('交互：', '拖动平移、滚轮缩放、双击复位'),
    ], { size: 11.5 }),
  ])
}

/* S7 招牌：三维场景 */
{
  const cw = (CW - 3 * 0.18) / 4
  SLIDES.push([
    ...chrome('三维：把抽象对象「拿」在手里转', '招牌能力 ③'),
    pic(VIZ('v-geom3d.png'), M, 1.52, cw, { ar: CAR, cap: 'geom3d · 正方体截面（自动求解）' }),
    pic(VIZ('v-lattice.png'), M + (cw + 0.18), 1.52, cw, { ar: CAR, cap: 'lattice3d · NaCl 晶胞与配位数' }),
    pic(VIZ('v-molecule.png'), M + 2 * (cw + 0.18), 1.52, cw, { ar: CAR, cap: 'molecule3d · CH₄ 构型（VSEPR 自动摆位）' }),
    pic(VIZ('v-globe.png'), M + 3 * (cw + 0.18), 1.52, cw, { ar: CAR, cap: 'globe3d · 夏至光照与晨昏线' }),
    blist(M, 4.55, HALF, 1.9, [
      B('拖拽旋转 · 滚轮缩放：', '立体几何、晶胞、分子、地球——全部可亲手转'),
      B('数学：', '截面自动求解；线面垂直证明看得见'),
    ], { size: 11.5 }),
    blist(X2, 4.55, HALF, 1.9, [
      B('化学 / 地理：', '每胞微粒数自动统计；晨昏线、正午太阳高度自动计算'),
      B('讲题联动：', '对话里模型按题目实时生成 3D 场景，落卡复用'),
    ], { size: 11.5 }),
  ])
}

/* S8 复习与学情 */
SLIDES.push([
  ...chrome('艾宾浩斯排期 + 学情统计', '核心能力 ②'),
  blist(M, TOP + 0.12, 4.95, 5.3, [
    B('入队即排期：', '新卡自动进入遗忘曲线关键复习点'),
    B('四档评分：', '重来 / 困难 / 良好 / 简单，直接驱动间隔调整'),
    B('错答重排队：', '答错的题 20 分钟后回到队列，当场闭环'),
    B('高考倒计时：', '按年级自动推算（高一 +2 年 / 高二 +1 年 / 高三当年 6·7）'),
    B('每日目标：', '复习条数 · 学习分钟 · 连续天数，今日页一眼看全'),
    B('薄弱排行 + 模考趋势：', '哪科掉分最多、哪个知识点最虚，统计页给答案'),
  ], { size: 12 }),
  pic(SHOT('a-review.png'), PIC_X, PIC_Y, PIC_W, { cap: '复习页：左演示画布 + 右翻卡，桌面双栏分屏' }),
])

/* S9 Windows 原生版 */
SLIDES.push([
  ...chrome('本版重点：Windows 原生版（Electron 壳）', 'v0.1.1 新增'),
  blist(M, TOP + 0.24, 5.95, 4.4, [
    B('web 层零改动：', '与 APK / PWA 字节级同一份 dist/，桌面差异全部由壳补齐'),
    B('app:// 特权协议：', '直读 asar 内资源，IndexedDB 获得稳定安全源'),
    B('桌面版 CapacitorHttp：', 'preload 把 http(s) fetch 透明转发主进程 net.fetch，AI 端点不受 CORS 限制（含中止语义）'),
    B('数据在 %APPDATA%\\高中助学：', '卸载重装不清库；备份 JSON 与插件/手机互导'),
    B('桌面习惯全套：', '中文原生菜单 · 右键粘贴 · Ctrl± 缩放 · F11 · 单实例'),
    B('一条命令出包：', 'npm run win —— macOS/Linux 交叉构建，无需 Windows、无需 wine'),
  ], { size: 11.5 }),
  table(6.95, 2.3, 5.78, [
    [{ t: '能力', h: 1 }, { t: 'Android', h: 1 }, { t: 'Windows 壳', h: 1 }],
    [{ t: '绕 CORS' }, { t: 'CapacitorHttp' }, { t: 'net.fetch 代理' }],
    [{ t: '资源加载' }, { t: 'WebView assets' }, { t: 'app:// + asar' }],
    [{ t: '离线' }, { t: '随包内置' }, { t: '随包整发（禁 SW）' }],
    [{ t: '持久化' }, { t: '应用私有目录' }, { t: '%APPDATA%' }],
    [{ t: '产物' }, { t: 'APK 3.9 MB' }, { t: 'setup/portable 97 MB' }],
  ], { colW: [1.5, 2.05, 2.23], rowH: 0.46 }),
  rect(M, 5.98, CW, 0.7, 'FFF4E3', { r: 0.12 }),
  text(M + 0.3, 5.98, CW - 0.6, 0.7, [
    { lead: '注意：', text: '未做代码签名——首次运行 SmartScreen 选「仍要运行」；分发量大再考虑购买签名证书。', warn: true },
  ], { size: 12, valign: 'middle' }),
])

/* S10 桌面 UI 适配 */
SLIDES.push([
  ...chrome('本版重点：桌面 UI 适配', 'v0.1.1 新增 · 大屏平板 PWA 同样受益'),
  blist(M, TOP + 0.12, 4.95, 5.3, [
    B('触发面 ≥900×561：', '手机（含横屏紧凑布局）零影响，双端回归全绿'),
    B('限宽居中：', '单列页 / 聊天消息列 ≤860，底部 Dock 收宽 780 居中'),
    B('双栏网格：', '今日双列；复习、演示「左画布 sticky + 右列表」分屏'),
    B('聊天侧栏常驻：', '修 LAND_MQ 旧口径——CSS 媒体查询早已备好，JS 门没放行'),
    B('鼠标反馈全套：', '按钮 / 评分块 / 演示卡 / 会话项 hover 态；隐藏触屏 VBar，杜绝双滚动条'),
    B('验收：', 'verify-desktop 19 项断言 + 悬浮玻璃 Dock 分支实测居中（centerOff=0）'),
  ], { size: 12 }),
  pic(SHOT('a-today.png'), PIC_X, PIC_Y, PIC_W, { cap: '今日页：hero 通栏 + 卡片双列 + 居中胶囊 Dock' }),
])

/* S11 工程质量 */
SLIDES.push([
  ...chrome('工程质量：同源移植 + 双层回归', '工程'),
  rect(M, TOP, HALF, 4.66, CARD, { line: LINE, shadow: true }),
  text(M + 0.3, TOP + 0.22, HALF - 0.6, 0.42, '移植机制（与 DSH 插件）', { size: 14, bold: true, color: BRAND }),
  blist(M + 0.3, TOP + 0.74, HALF - 0.6, 3.8, [
    B('字节级复制：', 'srs / importer / paper / scene / 引擎四件套… sync-from-plugin.mjs 一键同步'),
    B('正则锚点改写：', 'I/O 文件 node:fs→IndexedDB、Buffer→Uint8Array；锚点失配大声抛错，绝不产出半旧代码'),
    B('14 个工具协议：', '宿主从 DSH 换成 App 自己的 IndexedDB，逐行对齐'),
    B('GBK/UTF-16 嗅探：', 'zipfs 机械移植，编码兼容能力原样保留'),
  ], { size: 11.5 }),
  rect(X2, TOP, HALF, 4.66, CARD, { line: LINE, shadow: true }),
  text(X2 + 0.3, TOP + 0.22, HALF - 0.6, 0.42, '本版回归与修复', { size: 14, bold: true, color: OK }),
  blist(X2 + 0.3, TOP + 0.74, HALF - 0.6, 3.8, [
    B('70 项测试全绿：', '核心 26 + AI 端到端 31 + UI 冒烟 13；插件侧 frame-smoke 139 项覆盖引擎渲染'),
    B('桌面验收 19 项：', '1240×820 断言 + 手机横/竖屏回归截图'),
    B('图标编码器修 3 真 bug：', 'PNG CRC 大端 / CRC 表位移 / IIFE 漏调用——严格校验 badCRC=0'),
    B('斜面演示物理修正：', '摩擦力 210°→30°、"m=m"→"m"、滑块贴合斜面'),
    B('asar 564 KB：', '排除运行时不需要的 node_modules'),
  ], { size: 11.5 }),
])

/* S12 三端 + 数据互通 */
SLIDES.push([
  ...chrome('三端同源 · 数据互通', '生态'),
  table(M, TOP + 0.12, CW, [
    [{ t: '维度', h: 1 }, { t: 'PWA', h: 1 }, { t: 'Android APK', h: 1 }, { t: 'Windows 桌面', h: 1 }],
    [{ t: '形态' }, { t: '浏览器 + 主屏幕' }, { t: 'Capacitor 壳' }, { t: 'Electron 壳' }],
    [{ t: '网络代理' }, { t: '直连（可能吃 CORS）' }, { t: 'CapacitorHttp' }, { t: 'net.fetch 代理' }],
    [{ t: '离线' }, { t: 'service worker' }, { t: '随包内置' }, { t: '随包整发' }],
    [{ t: '数据位置' }, { t: '浏览器存储' }, { t: '应用私有目录' }, { t: '%APPDATA%\\高中助学' }],
    [{ t: '构建' }, { t: 'npm run build' }, { t: 'npm run apk' }, { t: 'npm run win' }],
  ], { colW: [1.95, 3.35, 3.4, 3.39], rowH: 0.46 }),
  blist(M, 4.62, CW, 1.9, [
    B('与 DSH 插件互导：', '设置页「数据与迁移」一次选中 ~/.dsh/highschool-tutor 六个 JSON——题库、复习进度、演示库、模考成绩原样带走'),
    B('三端之间：', '导出备份 JSON 任意端导入即恢复；API Key 不进备份、不外传'),
  ], { size: 12.5 }),
])

/* S13 产物清单 */
SLIDES.push([
  ...chrome('产物清单与安装', '发布'),
  table(M, TOP + 0.08, CW, [
    [{ t: '文件', h: 1 }, { t: '说明', h: 1 }, { t: 'SHA-256（前 16）', h: 1 }],
    [{ t: 'highschool-tutor-v0.1.1-win-x64-setup.exe' }, { t: 'NSIS 安装包 · 桌面+开始菜单快捷方式' }, { t: '09f7967bf20da742…' }],
    [{ t: 'highschool-tutor-v0.1.1-win-x64-portable.exe' }, { t: '便携版 · 免安装双击即用' }, { t: '08f2bdb42d45f835…' }],
    [{ t: 'highschool-tutor-v0.1.1-release.apk' }, { t: 'Android 正式签名（versionCode 2）' }, { t: '见 RELEASE.md' }],
    [{ t: 'dist/' }, { t: 'PWA 产物 · gzip 后约 140 KB' }, { t: '任意 HTTPS 静态托管' }],
  ], { colW: [4.9, 4.45, 2.74], rowH: 0.48 }),
  rect(M, 4.5, HALF, 2.2, CARD, { line: LINE, shadow: true }),
  text(M + 0.3, 4.7, HALF - 0.6, 0.4, '快速命令', { size: 14, bold: true, color: BRAND }),
  text(M + 0.3, 5.14, HALF - 0.55, 1.5, 'npm run win            出 Windows 安装包 + 便携版\nnpm run apk              出 Android debug APK\nnpm run smoke            桌面壳无头冒烟（4 项断言）\nnpm run verify-desktop     桌面 UI 验收（19 项断言）\nnpm test                 全量回归（70 项）', { size: 10, mono: true, lh: 1.4 }),
  rect(X2, 4.5, HALF, 2.2, CARD, { line: LINE, shadow: true }),
  text(X2 + 0.3, 4.7, HALF - 0.6, 0.4, '安装提示', { size: 14, bold: true, color: WARN }),
  blist(X2 + 0.3, 5.14, HALF - 0.6, 1.5, [
    { text: 'Windows：exe 未签名 → SmartScreen 点「仍要运行」' },
    { text: 'Android：debug 与 release 签名不同，换装需先卸载' },
    { text: '数据互通：三端 + 插件的备份 JSON 同格式，随意迁移' },
  ], { size: 11 }),
])

/* S14 尾页 */
SLIDES.push([
  bg(BRAND),
  rect(9.4, 4.1, 6.4, 6.4, PURPLE, { t: 48, r: 1.5 }),
  rect(-2.3, -2.5, 6.2, 6.2, DEEP, { t: 55, r: 1.5 }),
  text(1.15, 2.6, 11.0, 1.05, '把每一道错题，都变成得分点。', { size: 32, bold: true, color: CARD }),
  text(1.18, 3.82, 11.0, 0.5, '高中助学 · 语数英物化地 · v0.1.1 · GPL-3.0-or-later', { size: 14, color: SOFT }),
  text(1.18, 6.5, 11.5, 0.4, '插件与题库引擎：github.com/HokkaidoCOLA/dsh-highschool-tutor　·　数据不出本机', { size: 11, color: 'BFD3FF' }),
])

const PREVIEW = process.argv.includes('--preview')
if (PREVIEW) renderPreview(SLIDES, { out: resolve(ROOT, '.cache/ppt-preview.html'), footer: FOOTER })
else await renderPptx(SLIDES, { out: OUT, footer: FOOTER, title: '高中助学 v0.1.1 版本发布' })
