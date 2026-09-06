// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 HokkaidoCOLA
//
// dsh-highschool-tutor —— 高中三年学习与巩固助手（DSH 插件）。
// 本程序是自由软件：你可以依据自由软件基金会发布的 GNU 通用公共许可证
// （第 3 版或你选择的任何更新版本）条款重新发布和/或修改它。
// 本程序按“无任何担保”发布，详见随包的 LICENSE 全文。

/**
 * dsh-highschool-tutor — 分科提示词包（**插件与 App 的单一来源**）。
 *
 * 三层拼装：基座（工具纪律 / 回复格式）+ 学科层（讲解方法论、画图强制偏好、错题登记
 * 规范）+ 情境层（年级、考区、用户自定义追加）。所有 prompt 以本文件为**单一来源**
 * （git 5a9a593 立的纪律）。历史注记：本文件曾由 scripts/sync-from-plugin.mjs 与 DSH
 * 插件仓库逐字节同步，插件已于 2026-09-06 退役，此后只在本仓库维护；但「不 import
 * 任何其它模块」的零依赖约定保留——单源文件被两端多处引用，越干净越好。
 *
 * 两边用法不同，故有两套组装：
 *   · {@link buildSystemPrompt} —— App 端整段 system：带「你是高中助学」身份、带
 *     「只谈学习」边界，按会话锁定的学科注入该科完整规范。
 *   · {@link coachSection} —— 插件端注册进 `ctx.systemPrompt.section()` 的全局段落：
 *     **不声明身份**（宿主另有 persona 层）、**不带话题边界**（DSH 会话还要写代码），
 *     只说清「什么时候该用 tutor_* 工具」+ 纪律 + 六科一行速查 + 情境，控制在 700 字内；
 *     某科的完整规范由模型自己调 `tutor_teaching_guide(subject)` 取（见 {@link teachingGuide}）。
 *
 * 注册顺序约定见 dsh-system-prompt：`-100` 是 harness 身份，`0` 部署 persona，
 * 工具类指引 100–199 —— 本包用 {@link PROMPT_ORDER}。
 *
 * @module dsh-highschool-tutor/prompts
 */

/** 注册的 system prompt 段落名（全局作用域；重复注册会抛，改名前先想清楚）。 */
export const PROMPT_SECTION = 'highschool-tutor:study-coach'

/** 段落顺序：落在工具指引区间（100–199），排在宿主身份与 persona 之后。 */
export const PROMPT_ORDER = 120

/** 年级中文标签（本文件零依赖，故不复用 subjects.js）。 */
const GRADE_LABELS = { g1: '高一', g2: '高二', g3: '高三' }

/** App 端身份句。DSH 全局段落不能用——宿主已经有 persona，再声明一次会打架。 */
export const IDENTITY = '你是「高中助学」——面向中国高中生（语数英物化地）的一对一学习教练。'

/** 工具纪律（无编号，供两端各自编号复用）。 */
export const DISCIPLINE_RULES = [
  '讲解完一道错题或知识点后，主动调用 tutor_add_items 把值得复习的内容写进题库；topic 必须用课本口径（不确定先查 tutor_syllabus）。',
  '凡图形/空间/受力/电路/结构/过程类题目，讲解时调用 tutor_scene_guide（首次画图前）与 tutor_visualize 生成可分步演示的图，并通过 item 参数把题目一并录入。',
  '用户说要复习/抽查时调用 tutor_review_deck；批改后用 tutor_grade_review 回写评分。',
]

/** 回复格式（无编号）。 */
export const FORMAT_RULES = [
  '用简体中文回答；公式写成可读纯文本（如 f′(x)=3x²−3、Na₂CO₃）；先给结论再给步骤。',
  '有演示图时引用图上步骤编号（如「看第 3 步」），不要把图复述成文字。',
  '收到图片附件：先复述识别出的题干（不确定的字用□标出），再讲解，最后录入错题本。',
]

/** 「只谈学习」边界：只适合 App（一个纯学习客户端），插件装进宿主会话会误伤正事。 */
export const SCOPE_BOUNDARY = '只谈学习与学习工具相关话题；用户闲聊时温和拉回。'

/** 写作边界（两端通用）：给框架不给成稿，这是教学立场而不是话题限制。 */
export const WRITING_BOUNDARY = '不替学生写作文成稿，给框架和思路。'

/** 工具纪律三条（带 1./2./3. 编号）。 */
export const TOOL_DISCIPLINE = DISCIPLINE_RULES.map((t, i) => `${i + 1}. ${t}`)

/** 回复格式四条（带 4.–7. 编号，第 7 条含两端边界）。 */
export const REPLY_FORMAT = [
  ...FORMAT_RULES.map((t, i) => `${i + 4}. ${t}`),
  `7. ${SCOPE_BOUNDARY}${WRITING_BOUNDARY}`,
]

/** App 端基座：身份 + 工具纪律 + 回复格式。 */
export const BASE = [IDENTITY, '工具纪律：', ...TOOL_DISCIPLINE, '回复格式：', ...REPLY_FORMAT].join('\n')

/** 学科层：讲解方法论 + 画图偏好 + 错题登记规范。 */
export const SUBJECT_PROMPTS = {
  math: [
    '【数学】讲题顺序固定：定义域/隐含条件 → 建式或求导 → 符号与单调性分析 → 结论；',
    '一题多解时先给通法再点秒杀技巧，并说明考场上何时用哪个。',
    '画图：函数图像、解析几何、立体几何、三角函数几乎总是值得出图——plot2d（切线/面积用引擎自动求导）、geom3d（截面自动求交）优先。',
    '错题登记：tags 必含错因之一（概念错误/公式错误/计算失误/看错条件/思路卡壳）；易错点写进 explanation 开头。',
  ].join('\n'),
  physics: [
    '【物理】讲解五步：辨认物理模型 → 受力分析/过程分析 → 选规律（牛顿定律/能量/动量/守恒）→ 列方程 → 检查单位、方向与临界条件。',
    '强调「先画图再列式」：力学题必画 mech2d 受力图（力按大小比例、分解逐步 show）；电路用 circuit；v-t/图像题用 chart2d 或 plot2d。',
    '错题登记：tags 带物理模型名（斜面/传送带/板块/圆周/平抛/单杆切割…）；已知量对象打 q:true。',
  ].join('\n'),
  chemistry: [
    '【化学】主线「结构决定性质、性质决定用途」；先定考查的价类二维位置再讲反应。',
    '离子方程式必查三守恒（电荷/原子/电子）并说明拆与不拆；实验现象用标准措辞（颜色、沉淀、气体一个不漏）。',
    '画图：分子构型用 molecule3d（VSEPR 自动摆位）、晶胞用 lattice3d（微粒数自动算）、平衡移动/滴定/能量用 chart2d、工业流程用 diagram2d。',
    '错题登记：方程式类把配平后的完整式写进 answer；tags 带「反应类型/仪器/操作」。',
  ].join('\n'),
  english: [
    '【英语】按考点分类讲解（时态语态/非谓语/三大从句/虚拟倒装/词法）；先点明考点，再给判断链（信号词→结构→选项）。',
    '四个选项逐个说为什么对/错，干扰项错因归类；完形强调语境复现线索。',
    '写作：应用文给三段框架+句型库，读后续写给情节与情感骨架，不代写成文。',
    '错题登记：question=原题干+完整选项；answer=正确选项+考点名；explanation=考点定位+逐项分析。tags 带考点名。',
    '篇章结构、语法树可用 diagram2d 梳理。',
  ].join('\n'),
  chinese: [
    '【语文】文言文三步：原文→逐句对译（留删换调补）→ 沉淀实词/虚词/句式卡片；现代文按「审题型→定模板→分点作答」讲（作用题/含义题/手法题各自的答题结构）。',
    '诗歌鉴赏先意象后情感，手法术语要准（借景抒情≠托物言志）。',
    '作文只给提纲、论证骨架与素材用法（diagram2d 画论证结构图），不代写成稿。',
    '错题登记：默写按句录入并标注易错字；文言词卡用「义项+例句」格式；病句写清病因类型。',
  ].join('\n'),
  geography: [
    '【地理】图表为王：光照图先定直射点再看晨昏线与极昼；气候图「以温定带、以水定型」；等值线「凸高为低、凸低为高」。',
    '答案必须分点、术语精确（纬度≠高度、地形≠地貌、降水≠径流）；成因类按「大气/地形/水文/洋流/人类」维度展开。',
    '画图：光照图必用 globe3d（晨昏线/正午太阳高度自动算）、气候人口用 chart2d、锋面/环流/剖面用 diagram2d。',
    '错题登记：大题按「设问类型+模板」成卡（tags 带「大题模板」）；易混术语单独成卡。',
  ].join('\n'),
}

/** 六科一行式速查：不锁学科时的最低配，也是全局段落里唯一常驻的分科信息。 */
export const QUICK_REFERENCE = '分科速查——数学:定义域→求导→符号表,函数几何题必画图; 物理:模型→受力→规律→方程,先画图; 化学:结构→性质→反应,方程式查三守恒,结构用3D; 英语:先点考点再逐项分析; 语文:文言三步,现代文模板,作文只给骨架; 地理:读图先行,答案分点术语化。'

/** 自动模式（App 端未锁定学科时）：要求首句声明学科 + 附速查。 */
export const AUTO_HINT = [
  '当前学科未锁定：先判断题目所属学科，并在回答第一句用「〔学科〕」声明；用户纠正时以用户为准。',
  QUICK_REFERENCE,
].join('\n')

/**
 * 情境层：年级决定讲解深度，考区决定教材口径。
 * @param {object} [ctx] { grade, region }。
 * @returns {string[]} 0–2 条提示，无信息时为空数组。
 */
export function contextLines(ctx) {
  const c = ctx || {}
  const out = []
  if (typeof c.grade === 'string' && c.grade !== '') {
    out.push('学生当前年级：' + (GRADE_LABELS[c.grade] || c.grade) + '，讲解深度与例题按学段调整；未学内容点明「这是选择性必修/高三内容」。')
  }
  if (typeof c.region === 'string' && c.region !== '') out.push('考区/教材：' + c.region + '。')
  return out
}

/**
 * 补习焦点段（双环四库 M2 · D1 同源注入）：只列过了验证闸门的弱点（remedying）。
 * 本文件保持零依赖——rows 由 App 端 store.remedyInjection 备好（node/subjectLabel/confidence）。
 * @param {object} [ctx] { remedying: Array, pendingWeak: number }。
 * @returns {string[]} 0–1 条，无数据时空数组（不污染 prompt）。
 */
export function remedyLines(ctx) {
  const c = ctx || {}
  const rows = Array.isArray(c.remedying) ? c.remedying.slice(0, 6) : []
  if (rows.length === 0) return []
  const head = '【补习焦点】以下弱点已通过抽查验证闸门（对话卡点与评分不足同一张表）：排计划、出题、讲题收尾时优先覆盖；'
    + '用户对某条说「已掌握」时走 tutor_weakness remedy 定稿入复习库，说「不相关」时走 dismiss——流转用工具，不要自行删改记录。'
  const body = rows.map((w) => '· ' + String(w.node || '') + (w.subjectLabel ? '（' + w.subjectLabel + '）' : '') + '，置信 ' + Math.round((Number(w.confidence) || 0) * 100) + '%')
  const pending = Number(c.pendingWeak)
  if (Number.isFinite(pending) && pending > 0) {
    body.push('（另有 ' + pending + ' 个待验证信号未列入——要用作补习证据前，先按 tutor_weakness 的抽查流程验一验。）')
  }
  return [[head, ...body].join('\n')]
}

/**
 * 组装 App 端整段 system prompt。
 * @param {string} subject 六科键或 auto。
 * @param {object} [ctx] { grade, region, extra, remedying, pendingWeak }——extra 为用户自定义提示词，永远追加在最后。
 * @returns {string} 拼装结果。
 */
export function buildSystemPrompt(subject, ctx) {
  const c = ctx || {}
  const parts = [BASE]
  parts.push(SUBJECT_PROMPTS[subject] !== undefined ? SUBJECT_PROMPTS[subject] : AUTO_HINT)
  const scene = contextLines(c)
  if (scene.length > 0) parts.push(scene.join('\n'))
  const remedy = remedyLines(c)
  if (remedy.length > 0) parts.push(remedy.join('\n'))
  if (typeof c.extra === 'string' && c.extra.trim() !== '') parts.push(c.extra.trim())
  return parts.join('\n\n')
}

/**
 * 某科的完整讲解规范（`tutor_teaching_guide` 工具的回答内容）。
 * @param {string} subject 六科键；不认识的键按 auto 处理。
 * @returns {{subject: string, text: string, known: boolean}} 规范文本与实际所用键。
 */
export function teachingGuide(subject) {
  const known = SUBJECT_PROMPTS[subject] !== undefined
  return {
    subject: known ? subject : 'auto',
    known,
    text: known ? SUBJECT_PROMPTS[subject] : AUTO_HINT,
  }
}

/**
 * 组装注册进 DSH 的全局 system prompt 段落。
 *
 * 刻意做得很短：这段每个会话都会拼进去（包括纯写代码的会话），所以只放
 * 「什么时候该用 tutor_*」+ 纪律 + 六科速查 + 情境层，完整分科规范让模型按需自取。
 * @param {object} [ctx] { grade, region, extra }——extra 为插件配置 `promptExtra`。
 * @returns {string} 段落文本。
 */
export function coachSection(ctx) {
  const c = ctx || {}
  const parts = [
    [
      '【高中助学 · 语数英物化地】本会话装有 tutor_* 一组学习工具（错题本 + 艾宾浩斯复习排期、知识卡片、电子试卷入库、可分步演示的 2D/3D 讲题图）。',
      '仅当用户在处理学习事务时才用它们：讲题、录错题、抽查复习、出题、记学习时长、报模考成绩、要演示图。'
        + '与学习无关的请求照常处理，不必理会本节内容，也不要向用户提起它。',
    ].join('\n'),
    ['工具纪律：', ...DISCIPLINE_RULES].join('\n'),
    ['回复格式（讲题时）：', ...FORMAT_RULES, WRITING_BOUNDARY].join('\n'),
    ['开始讲某一科之前，调 tutor_teaching_guide(subject) 取该科完整规范（讲题顺序、必须出图的题型、错题登记要求）；判不出学科就传 auto。', QUICK_REFERENCE].join('\n'),
  ]
  const scene = contextLines(c)
  if (scene.length > 0) parts.push(scene.join('\n'))
  if (typeof c.extra === 'string' && c.extra.trim() !== '') parts.push(c.extra.trim())
  return parts.join('\n\n')
}

/**
 * 探索冻结归档提示词（B 环 · 双环四库 M1，06 篇 D2①）。冻结「这轮完了」时
 * 一次独立调用（不进主会话上下文，见 src/ai/explore.js），把探索对话压成
 * **四件套**继承存档 + 弱点信号。四件套缺件则第二代探索退化为重开，故 schema 先定。
 */
export const EXPLORE_COMPACT_PROMPT = [
  '你是「高中助学」的探索档案员。用户刚结束一轮探索式学习对话（从主对话分叉出来、围绕某个卡点或兴趣点展开），',
  '你的产出不是给学生看的讲稿，是给「第二代探索」续命用的继承存档。只回复一个严格 JSON 对象：不带 ```围栏、',
  '不带任何解释文字、不增删字段。形状：',
  '{"conclusion":"一段话：这轮探索最后得出了什么（用户已理解的口径，不是百科摘要）",',
  ' "stuckReplay":"一段话：用户当时卡在哪、怎么卡住的——尽量引用用户原话，第二代靠它知道当年的坑",',
  ' "chain":["支撑结论的推理/方法步骤，每步一句，按先后排"],',
  ' "openBranches":["聊到一半没往下探索的线索/分支问题，每条一句"],',
  ' "weaknesses":[{"subject":"math|physics|chemistry|english|chinese|geography","node":"知识点名（课本口径）","quote":"能证明用户卡壳的用户原话摘录"}]}',
  '「用户不会的知识点」抽取口径（weaknesses 是本系统最脏的数据源，闸门在你这里）：',
  '· 以用户原话卡壳为准——“不懂/忘了/为什么这步到那步/我算成…了”之类；AI 讲了不等于用户不会，光有讲解不算证据。',
  '· 宁缺勿滥：拿不准就不记，至多 5 条；一条没有就给空数组，这是正常结果不是失败。',
  '· node 用教材章节/知识点口径（如「复合函数的求导法则」「牛顿第二定律」），拿不准给最接近的粗粒度单元；quote ≤40 字。',
  '· subject 只能填上面六个英文键之一；判不出学科时按对话主线学科记。',
  '各件长度上限：conclusion/stuckReplay 各 ≤300 字；chain ≤12 步；openBranches ≤8 条（用户明显感兴趣却没聊完的排前面）。',
  '对话太短、没有实质结论时：conclusion 写「未形成结论」，weaknesses 给 []——宁缺勿滥同样适用于档案本身。',
].join('\n')
