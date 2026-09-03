// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 生成「高中助学 · 功能与使用（教师演示版）」PPT —— 面向高中老师，讲功能与用法，不讲发布细节。
 * 渲染逻辑见 scripts/ppt-lib.mjs；素材 = App 真实界面与演示画布截图。
 * 用法：node scripts/make-ppt-guide.mjs            → ~/Documents/演示/高中助学-功能与使用-教师演示.pptx
 *       node scripts/make-ppt-guide.mjs --preview  → .cache/ppt-preview-guide.html
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import {
  BRAND, PURPLE, DEEP, INK, INK2, SOFT, CARD, LINE, OK, WARN, FAINT,
  M, CW, TOP, BOT, HALF, X2, PIC_W, PIC_X, PIC_Y, CAR,
  rect, text, pic, B, blist, bg, icon, chrome, hline,
  renderPptx, renderPreview,
} from './ppt-lib.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOT = (f) => resolve(ROOT, '.preview/desktop', f)
const VIZ = (f) => resolve(ROOT, '.preview/viz', f)
const OUT_DIR = resolve(homedir(), 'Documents', '演示')
const OUT = resolve(OUT_DIR, '高中助学-功能与使用-教师演示.pptx')
const FOOTER = '高中助学 · 功能与使用（教师演示版）'

const SLIDES = []

/* S1 封面 */
SLIDES.push([
  bg(BRAND),
  rect(8.6, -1.7, 7.0, 7.0, PURPLE, { t: 45, r: 1.5 }),
  rect(-1.9, 4.7, 6.2, 6.2, DEEP, { t: 55, r: 1.5 }),
  icon(resolve(ROOT, 'public/icons/icon-512.png'), 1.12, 1.12, 0.92, { chip: true }),
  text(1.02, 0.66, 10.5, 0.32, '软件介绍 · 语 数 英 物 化 地 · 2026-08', { size: 10.5, color: SOFT, spacing: 3 }),
  text(2.42, 0.98, 9.6, 0.92, '高中助学', { size: 40, bold: true, color: CARD, spacing: 4, valign: 'middle' }),
  text(2.46, 1.98, 10.2, 0.52, '功能与使用方式 · 演示给老师看', { size: 18, color: SOFT }),
  rect(1.02, 3.28, 11.3, 2.42, CARD, { t: 88, r: 0.16 }),
  text(1.42, 3.62, 10.6, 0.56, '错题本 × 艾宾浩斯自动排期 × 二维/三维动态演示 × AI 讲题', { size: 17, bold: true, color: CARD }),
  text(1.42, 4.32, 10.6, 0.44, [{ lead: '一句话：', leadColor: CARD, soft: true, text: '把错题记下来，软件按遗忘曲线安排每天复习，难懂的题画出会动的图' }], { size: 13 }),
  text(1.42, 4.92, 10.6, 0.44, '手机 / 电脑 / 浏览器都能用 · 离线可用 · 数据全在本机 · 免费开源', { size: 12, color: 'BFD3FF' }),
  text(1.02, 6.62, 11.3, 0.4, 'GPL-3.0-or-later 开源 · 无广告 · 不收集任何个人信息', { size: 11, color: 'BFD3FF' }),
])

/* S2 为什么值得看（教师视角） */
SLIDES.push([
  ...chrome('为什么值得看一眼：平时辅导的四个难题', '缘起'),
  rect(M, TOP, HALF, 4.62, CARD, { line: LINE, shadow: true }),
  text(M + 0.3, TOP + 0.22, HALF - 0.6, 0.42, '我们常看到的', { size: 15, bold: true, color: WARN }),
  blist(M + 0.3, TOP + 0.78, HALF - 0.6, 3.7, [
    B('讲过的题还错：', '订正当场会，隔天照旧——没有复习节奏'),
    B('复习无法检查：', '学生说「复习过了」，看不看得到、牢不牢全凭自觉'),
    B('抽象概念难画：', '受力分析、立体截面、晶胞、晨昏线，黑板上画不出来'),
    B('错题本形同虚设：', '手抄太慢，坚持不过一周，抄完也不再翻'),
  ], { size: 12.5 }),
  rect(X2, TOP, HALF, 4.62, CARD, { line: LINE, shadow: true }),
  text(X2 + 0.3, TOP + 0.22, HALF - 0.6, 0.42, '这个软件的做法', { size: 15, bold: true, color: OK }),
  blist(X2 + 0.3, TOP + 0.78, HALF - 0.6, 3.7, [
    B('遗忘曲线自动排期：', '每道错题到点提醒重做，错 20 分钟后再来一遍'),
    B('复习留痕可量化：', '每天复习条数、连续天数、正确率、薄弱排行'),
    B('会动的讲解图：', '二维函数/电路/曲线，三维几何/分子/地球，可分步播放'),
    B('录入只要十秒：', '拍一张照，或把整份试卷拖进去自动拆题'),
  ], { size: 12.5 }),
  text(M, 6.32, CW, 0.42, '定位：学生自用的学习闭环工具——记题 → 复习 → 提问 → 可视化 → 看数据', { size: 12, color: INK2, align: 'center' }),
])

/* S3 功能总览 */
SLIDES.push([
  ...chrome('六大功能，三个设备', '功能总览'),
  ...[
    ['错题本 + 题库', '错题、知识卡片统一管理：检索、按薄弱筛选、导出', BRAND],
    ['艾宾浩斯复习', '按遗忘曲线自动排期，翻卡四档评分，错答即时回炉', OK],
    ['动态演示', '九种 2D/3D 场景，分步时间轴，3D 可拖拽旋转', PURPLE],
    ['试卷导入', '拖入 docx/pptx 整卷：自动切题、识别选项、答案回填', 'C0392B'],
    ['AI 讲题', '拍照问题、语音式对话讲解，还能现场画演示图', WARN],
    ['学情统计', '高考倒计时、每日曲线、掌握度、模考成绩趋势', '5B6EF0'],
  ].map((p, i) => {
    const w = (CW - 2 * 0.24) / 3, x = M + (i % 3) * (w + 0.24), y = TOP + Math.floor(i / 3) * 2.32
    return [
      rect(x, y, w, 2.14, CARD, { line: LINE, shadow: true }),
      rect(x + 0.24, y + 0.26, 0.5, 0.13, p[2], { r: 0.065 }),
      text(x + 0.22, y + 0.48, w - 0.4, 0.44, p[0], { size: 15.5, bold: true }),
      text(x + 0.22, y + 0.96, w - 0.42, 1.1, p[1], { size: 10.5, color: INK2, lh: 1.28 }),
    ]
  }).flat(),
  text(M, 6.24, CW, 0.5, 'Android 手机 · Windows 电脑 · 浏览器 PWA —— 同一套数据格式，进度可互相导入', { size: 13, bold: true, color: BRAND, align: 'center' }),
])

/* S4 使用 · 安装与起步 */
SLIDES.push([
  ...chrome('怎么用 ①：安装与起步（三分钟）', '使用 · 上手'),
  ...[
    ['手机（Android）', '安装 APK 文件；或用浏览器打开网址 →「添加到主屏幕」', BRAND],
    ['电脑（Windows）', '运行安装包，或用免安装便携版，双击即用', PURPLE],
    ['浏览器（PWA）', '打开部署好的网址即用，断网也能继续复习', '0E8F86'],
  ].map((p, i) => {
    const w = (CW - 2 * 0.24) / 3, x = M + i * (w + 0.24)
    return [
      rect(x, TOP, w, 1.9, CARD, { line: LINE, shadow: true }),
      rect(x + 0.24, TOP + 0.26, 0.5, 0.13, p[2], { r: 0.065 }),
      text(x + 0.22, TOP + 0.46, w - 0.4, 0.42, p[0], { size: 14.5, bold: true }),
      text(x + 0.22, TOP + 0.92, w - 0.42, 0.9, p[1], { size: 10.5, color: INK2, lh: 1.28 }),
    ]
  }).flat(),
  text(M, 3.66, CW, 0.4, '首次打开，只做三件事：', { size: 13, bold: true }),
  blist(M, 4.1, CW, 1.6, [
    B('第 1 步 · 设置页选年级和考区：', '高考倒计时、复习目标自动按学段配好（人教版口径）'),
    B('第 2 步 · 录几道错题开跑：', '手录、拍照或导入试卷任选——当天就会生成第一份复习队列'),
    B('第 3 步（可选）· 接一个 AI：', '「设置 → AI 接入」填地址 / Key / 模型名，任意 OpenAI 兼容服务；不接也不影响全部核心功能'),
  ], { size: 12 }),
  rect(M, 6.02, CW, 0.7, 'FFF4E3', { r: 0.12 }),
  text(M + 0.3, 6.02, CW - 0.6, 0.7, [
    { lead: '给老师的定心丸：', text: '所有数据只存在学生自己的设备里；没有账号体系、不上传、无广告。', warn: true },
  ], { size: 12, valign: 'middle' }),
])

/* S5 使用 · 录题 */
SLIDES.push([
  ...chrome('怎么用 ②：把错题记进来（三种方式）', '使用 · 录入'),
  blist(M, TOP + 0.12, 4.95, 5.3, [
    B('拍照录题（最快）：', '聊天页点相机，拍练习册上的错题，AI 识别题干自动入库、进入排期'),
    B('整卷导入（最省力）：', '把 docx / pptx 试卷拖进聊天页——自动按题号切分、识别 ABCD 选项、文末答案回填'),
    B('手动录入（最可控）：', '学科 + 题干 + 答案 + 解析，四十秒一道；也支持 Markdown / 表格批量粘贴'),
    B('内置起步包：', '六科高频知识卡片一键导入，第一天就有东西可复习'),
    B('入库即排期：', '每道题自动进入遗忘曲线，到日子出现在「今日」队列里'),
  ], { size: 12 }),
  pic(SHOT('a-library.png'), PIC_X, PIC_Y, PIC_W, { cap: '题库页：检索、按学科/知识点筛选、一键导出' }),
])

/* S6 使用 · 每日复习闭环 */
{
  const cw = (CW - 0.42) / 2
  const heads = [
    ['① 打开「今日」', '倒计时 + 今日待复习数量，一眼知道要干什么'],
    ['② 翻卡作答', '先看题干自己答，再点显示答案对照'],
    ['③ 四档自评', '重来 / 困难 / 良好 / 简单'],
    ['④ 自动安排下次', '答错 20 分钟后回炉；答对间隔拉长'],
  ]
  SLIDES.push([
    ...chrome('怎么用 ③：每天十分钟的复习闭环', '使用 · 复习'),
    ...heads.map(([h, d], i) => {
      const w = (CW - 3 * 0.18) / 4
      return text(M + i * (w + 0.18), 1.36, w, 1.0, [{ lead: h + '　', text: d }], { size: 10.5, lh: 1.2 })
    }),
    pic(SHOT('a-today.png'), M, 2.72, cw, { cap: '今日页：队列、分科待复习、快速记一笔' }),
    pic(SHOT('a-review.png'), X2, 2.72, cw, { cap: '复习页：左边演示画布 + 右边翻卡评分' }),
    text(M, 6.98, CW, 0.36, '复习进度实时写入本机数据库——连续天数、正确率、掌握度都是真实数据', { size: 11, color: INK2, align: 'center' }),
  ])
}

/* S7 使用 · 二维演示 */
{
  const cw = (CW - 2 * 0.24) / 3
  SLIDES.push([
    ...chrome('怎么用 ④：讲不懂的题——二维动态图', '使用 · 演示'),
    pic(VIZ('v-plot2d.png'), M, 1.38, cw, { cap: '数学：导数的几何意义，切线随切点出现' }),
    pic(VIZ('v-circuit.png'), M + cw + 0.24, 1.38, cw, { cap: '物理：滑动变阻器变化，电路分步重画' }),
    pic(VIZ('v-chart2d.png'), M + 2 * (cw + 0.24), 1.38, cw, { cap: '化学：升温瞬间 v-t 突跃，平衡移动方向' }),
    blist(M, 5.0, HALF, 1.9, [
      B('分步时间轴：', '每张图按讲解节奏一步步「长」出来，★ 标关键步骤，可自动播放'),
      B('课堂/自学两用：', '老师讲解可投屏，学生自学可反复回放'),
    ], { size: 11.5 }),
    blist(X2, 5.0, HALF, 1.9, [
      B('可交互：', '拖动平移、滚轮缩放、双击复位'),
      B('来源三种：', '内置样例 / 对话里 AI 按题目现场生成 / JSON 导入'),
    ], { size: 11.5 }),
  ])
}

/* S8 使用 · 三维演示 */
{
  const cw = (CW - 3 * 0.18) / 4
  SLIDES.push([
    ...chrome('怎么用 ⑤：抽象对象——三维拿在手里转', '使用 · 演示'),
    pic(VIZ('v-geom3d.png'), M, 1.52, cw, { cap: '数学：正方体截面自动求解' }),
    pic(VIZ('v-lattice.png'), M + (cw + 0.18), 1.52, cw, { cap: '化学：NaCl 晶胞，每胞微粒数自动统计' }),
    pic(VIZ('v-molecule.png'), M + 2 * (cw + 0.18), 1.52, cw, { cap: '化学：CH₄ 构型按 VSEPR 自动摆位' }),
    pic(VIZ('v-globe.png'), M + 3 * (cw + 0.18), 1.52, cw, { cap: '地理：夏至光照，晨昏线自动计算' }),
    blist(M, 4.55, HALF, 1.9, [
      B('手指一拖就能转：', '立体几何、晶胞、分子、地球——不用在黑板上「画意会」了'),
      B('数学难点：', '线面垂直证明、截面问题，看得见才好想'),
    ], { size: 11.5 }),
    blist(X2, 4.55, HALF, 1.9, [
      B('理综 / 地理：', '分子空间结构、晶胞配位数、正午太阳高度随日期变化'),
      B('和错题绑定：', '演示卡可以挂在题目上，复习翻到那题图就在旁边'),
    ], { size: 11.5 }),
  ])
}

/* S8.5 六科演示一览（截图来自随附的互动 HTML，画布 2440×1040） */
{
  const SAR = 2440 / 1040
  const w = (CW - 2 * 0.24) / 3, h = w / SAR
  const items = [
    ['s-math.png', '数学 · y=Asin(ωx+φ) 四步变换'],
    ['s-physics.png', '物理 · 磁场中的圆周运动'],
    ['s-chinese.png', '语文 · 《天净沙·秋思》意象组合'],
    ['s-chemistry.png', '化学 · 中和滴定的 pH 突跃'],
    ['s-english.png', '英语 · 长难句拆主干'],
    ['s-geography.png', '地理 · 三圈环流剖面'],
  ]
  SLIDES.push([
    ...chrome('六科演示，一屏看全', '使用 · 演示'),
    ...items.map((it, i) => pic(VIZ(it[0]), M + (i % 3) * (w + 0.24), 1.35 + Math.floor(i / 3) * (h + 0.56), w, { ar: SAR, cap: it[1] })),
    rect(M, 5.85, CW, 1.0, 'EAF1FE', { r: 0.14 }),
    text(M + 0.35, 5.85, CW - 1.9, 1.0, [
      { lead: '互动文件已嵌入本页：', text: '双击右下角图标 → 提取 → 打开，浏览器里亲手玩上面每一张图。' },
      { text: '切换学科 · 空格走步骤 · 3D 拖拽旋转 · 单文件离线', color: INK2 },
    ], { size: 12, valign: 'middle', lh: 1.35 }),
  ])
}

/* S9 使用 · AI 对话 */
SLIDES.push([
  ...chrome('怎么用 ⑥：AI 当 24 小时助教', '使用 · AI'),
  blist(M, TOP + 0.12, 4.95, 5.3, [
    B('一句话发题：', '拍照或粘贴题目，AI 按「先结论后步骤」讲解，深度随年级调整'),
    B('说「抽查我」：', 'AI 从今日复习队列抽题当场提问，评分自动记回排期'),
    B('让它画图：', '「画个传送带受力分析」——生成可分步播放的演示卡'),
    B('丢整份卷子：', '「把这份月考卷导进题库」——自动切题入库'),
    B('对老师透明：', 'AI 只是「嘴」，题库/排期/统计都在本机执行，不联网也能用全部核心功能'),
  ], { size: 12 }),
  pic(SHOT('a-chat.png'), PIC_X, PIC_Y, PIC_W, { cap: '聊天页：拍照 / 附件 / 建议气泡，桌面版左侧还有历史会话' }),
])

/* S10 使用 · 学情与数据 */
SLIDES.push([
  ...chrome('怎么用 ⑦：学了什么样，数据说话', '使用 · 统计'),
  blist(M, TOP + 0.12, 4.95, 5.3, [
    B('统计页：', '每日复习量曲线、学习时长、连续天数、各科掌握度、记忆保持率'),
    B('薄弱排行：', '错得多、掌握度低的知识点排在前面——下一步补哪目了然'),
    B('模考趋势：', '每次月考录一次分数，各科涨跌和排名变化一条曲线看清'),
    B('备份与迁移：', '设置页一键导出 JSON；手机记的题可以导入电脑接着用'),
    B('给家长/老师看：', '连续天数和正确率是「真复习」的证据，不再口头汇报'),
  ], { size: 12 }),
  pic(SHOT('a-stats.png'), PIC_X, PIC_Y, PIC_W, { cap: '统计页：时间窗曲线 + 掌握度 + 模考趋势' }),
])

/* S11 场景与答疑 */
SLIDES.push([
  ...chrome('用在哪、老师可能想问的', '场景 · Q&A'),
  rect(M, TOP, HALF, 4.62, CARD, { line: LINE, shadow: true }),
  text(M + 0.3, TOP + 0.22, HALF - 0.6, 0.42, '典型用法', { size: 15, bold: true, color: BRAND }),
  blist(M + 0.3, TOP + 0.78, HALF - 0.6, 3.7, [
    B('每日课后 10 分钟：', '打开「今日」清队列，错题不再过夜'),
    B('考前两周总攻：', '按薄弱排行集中翻卡，演示卡回炉概念'),
    B('周末整理：', '把一周的试卷拍照/拖入归档，下周排期自动跟上'),
    B('家长监督：', '看连续天数与正确率曲线即可，不必盯过程'),
  ], { size: 12 }),
  rect(X2, TOP, HALF, 4.62, CARD, { line: LINE, shadow: true }),
  text(X2 + 0.3, TOP + 0.22, HALF - 0.6, 0.42, '常见问题', { size: 15, bold: true, color: OK }),
  blist(X2 + 0.3, TOP + 0.78, HALF - 0.6, 3.7, [
    B('数据安全吗：', '全部存本机（题库/进度/设置），无账号无上传；AI 请求只发给自选端点'),
    B('收费吗：', '免费开源（GPL），无广告无内购'),
    B('断网能用吗：', '复习、题库、演示、统计全离线；只有 AI 讲题需要网络'),
    B('用什么模型：', '任意 OpenAI 兼容服务（DeepSeek、通义、Kimi、GPT 等），自备 Key'),
  ], { size: 12 }),
])

/* S12 尾页 */
SLIDES.push([
  bg(BRAND),
  rect(9.4, 4.1, 6.4, 6.4, PURPLE, { t: 48, r: 1.5 }),
  rect(-2.3, -2.5, 6.2, 6.2, DEEP, { t: 55, r: 1.5 }),
  text(1.15, 2.35, 11.0, 1.05, '把每一道错题，都变成得分点。', { size: 32, bold: true, color: CARD }),
  text(1.18, 3.55, 11.0, 0.5, '欢迎试用 · 求指点 —— 手机装 APK，电脑装 Windows 版，浏览器直接打开', { size: 14, color: SOFT }),
  text(1.18, 6.5, 11.5, 0.4, '开源地址：github.com/HokkaidoCOLA/dsh-highschool-tutor　·　GPL-3.0-or-later　·　数据不出本机', { size: 11, color: 'BFD3FF' }),
])

/* S13 彩蛋 · 创作名单 */
SLIDES.push([
  hline(M, 1.06, CW),
  text(M, 1.7, CW, 0.4, '—— 彩 蛋 · 出 品 名 单 ——', { size: 12, color: FAINT, align: 'center', spacing: 2 }),
  text(M, 2.5, CW, 0.55, '所有内容由 deepseek-harness 搭配 qwen3.8flash-next——', { size: 16, bold: true, align: 'center' }),
  text(M, 3.1, CW, 0.55, '与一个即将改变世界的大模型，共同完成创作。', { size: 16, bold: true, align: 'center' }),
  text(M, 4.0, CW, 0.45, '这份 PPT 的文案与版式、六科演示的图（切线 / 电路 / 滴定 / 截面 / 晶胞 / 晨昏线），', { size: 12, color: INK2, align: 'center' }),
  text(M, 4.42, CW, 0.45, '与这个软件本身一样，皆为「人当船长、AI 当水手」的产物。', { size: 12, color: INK2, align: 'center' }),
  text(M, 5.3, CW, 0.45, '错题是你的，得分点是我们的。', { size: 13.5, bold: true, color: BRAND, align: 'center' }),
  text(M, 6.7, CW, 0.36, 'GPL-3.0-or-later · 开源，每一行代码都经得起审视', { size: 10.5, color: FAINT, align: 'center' }),
])

const PREVIEW = process.argv.includes('--preview')
if (PREVIEW) renderPreview(SLIDES, { out: resolve(ROOT, '.cache/ppt-preview-guide.html'), footer: FOOTER })
else await renderPptx(SLIDES, { out: OUT, footer: FOOTER, title: '高中助学 · 功能与使用（教师演示版）' })
