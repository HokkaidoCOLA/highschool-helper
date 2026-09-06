// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 工具循环端到端测试：本地假 OpenAI 服务驱动 runAssistant——
 * 录题 → 画图（含 presentationMeta 投影与演示入库）→ 收尾文本，全程真 store 落库。
 * node 24 自带 fetch；localStorage 打内存桩。
 */
import http from 'node:http'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
}

const { store } = await import('../src/state.js')
const llm = await import('../src/ai/llm.js')
const { EXAMPLES } = await import('../src/core/examples.js')

let passed = 0
const failures = []
function ok(label, cond, extra) {
  if (cond) { passed += 1; console.log('  ✓ ' + label) }
  else { failures.push(label); console.error('  ✗ ' + label + (extra ? ' → ' + extra : '')) }
}

await store.load()

// 剧本：工具调用两轮后给最终文本
const scenarios = [
  { tool: { name: 'tutor_add_items', args: { items: [{ subject: 'math', kind: 'mistake', topic: '一元函数的导数及其应用', question: '求 x³−3x 极小值', answer: 'f(1)=−2', explanation: '先求导找驻点' }] } } },
  { tool: { name: 'tutor_visualize', args: { scene: EXAMPLES.plot2d, item: { subject: 'math', kind: 'mistake', topic: '一元函数的导数及其应用', question: '结合图象讲极小值', answer: 'f(1)=−2' } } } },
  { text: '图与题都进库了，去复习页抽查我。' },
]
const requests = []
let step = 0
const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    requests.push(parsed)
    const sc = scenarios[step]
    const message = sc.text !== undefined
      ? { role: 'assistant', content: sc.text }
      : { role: 'assistant', content: null, tool_calls: [{ id: 'call_' + step, type: 'function', function: { name: sc.tool.name, arguments: JSON.stringify(sc.tool.args) } }] }
    step += 1
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message }] }))
  })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
llm.saveAiConfig({ baseUrl: 'http://127.0.0.1:' + port + '/v1', model: 'stub-model', apiKey: 'test' })

const apiMsgs = [{ role: 'user', content: '讲一下 x³−3x 的极小值，配个图' }]
const events = []
const final = await llm.runAssistant(apiMsgs, (ev) => events.push(ev))

ok('最终文本透传', final === '图与题都进库了，去复习页抽查我。', final)
ok('事件流 4 条（两工具 run+done）', events.length === 4 && events[1].phase === 'done' && events[3].phase === 'done')
ok('工具摘要中文化', events[0].label.includes('录入题库') && events[2].label.includes('动态演示'))
ok('第二轮请求携带 tool 角色回灌', requests[1].messages.some((m) => m.role === 'tool'))
ok('携带 OpenAI tools schema（M4 后 18 个）', Array.isArray(requests[0].tools) && requests[0].tools.length === 18 && requests[0].tools[0].function.name === 'tutor_dashboard')
const demoEvent = events.find((e) => e.phase === 'done' && e.meta && e.meta.kind === 'hst-demo')
ok('visualize 的 presentationMeta 投影完整', Boolean(demoEvent) && demoEvent.ok && demoEvent.meta.scene && Array.isArray(demoEvent.meta.keySteps), demoEvent ? String(demoEvent.error || 'meta缺') : '无demo事件')
const items = store.db().items
ok('模型录的题已入题库', items.some((i) => i.question.includes('x³−3x')))
ok('visualize 附带 item 一并入库并关联', items.some((i) => i.id === demoEvent.meta.itemId))
const demos = store.demoDb().demos
ok('演示已存演示库（可回播）', demos.length === 1 && demos[0].itemId !== '')
ok('system 提示词只保留一份', requests[1].messages.filter((m) => m.role === 'system').length === 1)

// 错误路径：端点 404 → 可读错误
const bad = http.createServer((req, res) => { res.writeHead(404); res.end('not found') })
await new Promise((r) => bad.listen(0, '127.0.0.1', r))
llm.saveAiConfig({ baseUrl: 'http://127.0.0.1:' + bad.address().port, model: 'stub', apiKey: 'x' })
let errText = ''
try { await llm.runAssistant([{ role: 'user', content: 'hi' }]) } catch (err) { errText = String(err.message) }
ok('端点错误有可读提示', errText.includes('404'), errText)

// ── 会话层：一轮对话不依赖任何 UI 也能完整跑完（= 切页不打断的本质）──
const session = await import('../src/ai/session.js')
await session.loadConversations()
const srv2 = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    const hasTool = parsed.messages.some((m) => m.role === 'tool')
    const message = hasTool
      ? { role: 'assistant', content: '已录入并排期。' }
      : { role: 'assistant', content: null, tool_calls: [{ id: 's1', type: 'function', function: { name: 'tutor_add_items', arguments: JSON.stringify({ items: [{ subject: 'physics', kind: 'mistake', topic: '抛体运动', question: '会话层测试题', answer: 'B' }] }) } }] }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message }] }))
  })
})
await new Promise((r) => srv2.listen(0, '127.0.0.1', r))
llm.saveAiConfig({ baseUrl: 'http://127.0.0.1:' + srv2.address().port + '/v1', model: 'stub', apiKey: 'x' })
session.setDraftText('草稿在发送后应清空')
const inflight = session.sendUser('帮我把这道物理错题记一下', [])
ok('发送即 busy（此刻切页也不会中断）', session.getSession().busy === true)
ok('发送即清空草稿', session.getSession().draftText === '')
await inflight
const sitems = session.getSession().items
ok('消息流含 user/工具/assistant 三类', sitems.some((i) => i.kind === 'user') && sitems.some((i) => i.kind === 'tool') && sitems.some((i) => i.kind === 'assistant' && i.text === '已录入并排期。'))
ok('完成后回到空闲', session.getSession().busy === false)
ok('工具真实落库（会话层贯通 store）', store.db().items.some((i) => i.question === '会话层测试题'))
session.clearSession()
ok('新会话清空消息流', session.getSession().items.length === 0)
srv2.close()




// ── 多会话管理（侧边栏的数据层）──
const idA = session.getSession().activeId
session.newConversation()
const st1 = session.getSession()
ok('新建后会话数 +1 且切换活跃', st1.convs.length === 2 && st1.activeId !== idA)
session.pushItem({ kind: 'notice', text: 'B 会话的消息' })
session.switchConversation(idA)
ok('切换后消息流互相独立', session.getSession().items.every((i) => i.text !== 'B 会话的消息'))
session.switchConversation(st1.activeId)
ok('切回 B 消息还在', session.getSession().items.some((i) => i.text === 'B 会话的消息'))
session.renameConversation(idA, '我的错题讲解')
ok('重命名生效', session.getSession().convs.find((c) => c.id === idA).title === '我的错题讲解')
// 持久化往返：等 persist 防抖落地后模拟重启
await new Promise((r) => setTimeout(r, 700))
await session.loadConversations()
const after = session.getSession()
ok('重启后两个会话都在', after.convs.length === 2)
ok('重启后标题/消息保留', after.convs.some((c) => c.title === '我的错题讲解') && after.convs.some((c) => c.items.some((i) => i.text === 'B 会话的消息')))
session.deleteConversation(idA)
ok('删除后剩一个且自动切换', session.getSession().convs.length === 1 && session.getSession().activeId !== idA)
session.deleteConversation(session.getSession().convs[0].id)
ok('删光后自动新建空会话', session.getSession().convs.length === 1 && session.getSession().items.length === 0)

// ── 删除在途会话不得复活（persist 必须跳过已从列表移除的会话）──
const slow = http.createServer(() => { /* 永不回包：制造在途请求 */ })
await new Promise((r) => slow.listen(0, '127.0.0.1', r))
llm.saveAiConfig({ baseUrl: 'http://127.0.0.1:' + slow.address().port + '/v1', model: 'stub', apiKey: 'x' })
session.newConversation()
const doomed = session.getSession().activeId
const inflightDoomed = session.sendUser('在途会话删除测试', [])
session.deleteConversation(doomed)          // 请求在途时删除
session.stopUser()                           // 中止 → 错误收尾回调触发 persist
await inflightDoomed
await new Promise((r) => setTimeout(r, 800)) // 越过 persist 的 500ms 防抖
const revived = await (await import('../src/core/idb.js')).convGetAll()
ok('在途会话删除后不落盘复活', revived[doomed] === undefined, Object.keys(revived).join(','))
slow.close()

// ── 学科层：锁定学科后 system 注入学科方法论；auto 注入声明指令 ──
const seen = []
const srv3 = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    seen.push(parsed.messages[0].content)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '好' } }] }))
  })
})
await new Promise((r) => srv3.listen(0, '127.0.0.1', r))
llm.saveAiConfig({ baseUrl: 'http://127.0.0.1:' + srv3.address().port + '/v1', model: 'stub', apiKey: 'x' })
session.newConversation()
session.setConversationSubject(session.getSession().activeId, 'physics')
await session.sendUser('斜面上的滑块怎么分析', [])
ok('锁定物理 → system 含受力分析与模型词', seen[seen.length - 1].includes('受力分析') && seen[seen.length - 1].includes('传送带'))
ok('锁定物理 → 不再含数学定义域指令', !seen[seen.length - 1].includes('定义域'))
ok('基座与情境仍在', seen[seen.length - 1].includes('tutor_add_items'))
session.newConversation()
await session.sendUser('这道题讲讲', [])
ok('auto 会话 → system 含学科声明指令', seen[seen.length - 1].includes('〔学科〕'))
session.setConversationSubject(session.getSession().activeId, '不存在的科')
ok('非法学科被拒（保持 auto）', session.getSession().convs.find((c) => c.id === session.getSession().activeId).subject === 'auto')
srv3.close()

// ── M1 · B 环骨架：fork → 聊 → ❄冻结归档 → 重启 B₂ 完整（研究区 PLAN §2-M1）──
const explore = await import('../src/ai/explore.js')
const ARCHIVE = {
  conclusion: '链式法则会拆内外层了',
  stuckReplay: '学生说「内层导数老忘乘」，两次举例后通',
  chain: ['先认外层', '再导内层', '相乘'],
  openBranches: ['隐函数求导没碰'],
  weaknesses: [{ subject: 'math', node: '复合函数的求导法则', quote: '内层导数老忘乘' }],
}
let archiveCalls = 0
const srvM1 = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    const isArchive = parsed.messages[0] && parsed.messages[0].role === 'system' && String(parsed.messages[0].content).includes('探索档案员')
    let content
    if (isArchive) {
      archiveCalls += 1
      content = archiveCalls === 2 ? '抱歉，这轮我总结不出来。' : JSON.stringify(ARCHIVE)
    } else {
      content = '好，我们继续。'
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }))
  })
})
await new Promise((r) => srvM1.listen(0, '127.0.0.1', r))
llm.saveAiConfig({ baseUrl: 'http://127.0.0.1:' + srvM1.address().port + '/v1', model: 'stub', apiKey: 'x' })

const parentConv = session.newConversation()
await session.sendUser('复合函数到底怎么求导', [])
const pitems = session.getSession().items
const kid = session.forkConversation(parentConv.id, pitems[0].id)
ok('fork：kind/gen/parentId/forkFrom 齐', kid.kind === 'exploration' && kid.gen === 1 && kid.parentId === parentConv.id && kid.forkFrom.itemId === pitems[0].id)
ok('fork：标题「母题 · 探索 N」', kid.title.includes('· 探索 1'), kid.title)
ok('fork：items 前缀含截断点那条', kid.items.length === 1 && kid.items[0].kind === 'user')
ok('fork：apiMessages 截到完整回合（含该 user 条）', kid.apiMessages.length === 1 && kid.apiMessages[0].role === 'user')
ok('fork 后活跃即子会话', session.getSession().activeId === kid.id)
const kid2 = session.forkConversation(parentConv.id, pitems[1].id)
ok('第二条探索序号 +1', kid2.title.includes('· 探索 2'), kid2.title)
ok('assistant 行分叉：上下文 = user+assistant（system 会被重建）', kid2.apiMessages.filter((m) => m.role !== 'system').length === 2)
session.switchConversation(kid.id)
await session.sendUser('那隐函数呢……先记着', [])
ok('子会话续聊不回流母会话', session.getSession().items.length === 3 && parentConv.items.length === 2)

const fz = await explore.freezeExploration(kid.id)
ok('❄冻结归档成功：四件套完整入库', fz.ok === true && fz.exploration.compact.conclusion === ARCHIVE.conclusion && fz.exploration.compact.chain.length === 3 && archiveCalls === 1)
ok('归档后 B₂ 会话冻结（frozen=true）', session.getConversation(kid.id).frozen === true)
const beforeFrozen = session.getSession().items.length
await session.sendUser('冻结后还能发吗', [])
ok('冻结会话拒发只留提示', session.getSession().items.length === beforeFrozen + 1 && session.getSession().items[beforeFrozen].kind === 'notice' && !session.getSession().items.some((i) => i.text === '冻结后还能发吗'))
const explRec = store.explorationDb().explorations.find((e) => e.convId === kid.id)
ok('B₂ 档案在 explorations 表（degraded=false）', Boolean(explRec) && explRec.degraded === false && explRec.compact.openBranches.length === 1)
const wkList = store.listWeaknesses({})
ok('弱点入库 source=explore/status=discovered（M1 只入库不注入）', wkList.total === 1 && wkList.weaknesses[0].status === 'discovered' && wkList.weaknesses[0].source === 'explore')
ok('弱点证据带会话出处', wkList.weaknesses[0].evidence[0].src === 'conv:' + kid.id)

// 降级路径：归档调用返回散文 → 只存 transcript 档、弱点不涨、解冻可重试
session.switchConversation(kid2.id)
await session.sendUser('从第二条探索继续', [])
const fz2 = await explore.freezeExploration(kid2.id)
ok('解析失败降级：ok=false + degraded 档 + compact 空', fz2.ok === false && fz2.degraded === true && fz2.exploration.degraded === true && fz2.exploration.compact === null)
ok('降级不动弱点表', store.listWeaknesses({}).total === 1)
ok('降级后自动解冻（可再点这轮完了）', session.getConversation(kid2.id).frozen === false)
const fz3 = await explore.freezeExploration(kid2.id)
ok('解冻重试成功', fz3.ok === true && archiveCalls === 3)

// 重启：会话与两张新表都从持久层回读
await new Promise((r) => setTimeout(r, 700))
await store.flush()
await session.loadConversations()
const rb = session.getConversation(kid.id)
ok('重启后 B₂ 会话骨架完整（三处同步生效）', rb.kind === 'exploration' && rb.frozen === true && rb.gen === 1 && rb.parentId === parentConv.id && rb.items.length >= 5)
const { Store } = await import('../src/core/store.js')
const sRestart = await new Store().load()
const arch2 = sRestart.explorationDb().explorations.find((e) => e.convId === kid.id)
ok('重启后四件套从盘读回', Boolean(arch2) && arch2.compact.stuckReplay === ARCHIVE.stuckReplay && arch2.weaknessIds.length === 1)
const wk2 = sRestart.weaknessDb().weaknesses
ok('重启后弱点表从盘读回', wk2.length === 1 && wk2[0].node === '复合函数的求导法则')

// 老记录零回归：无新字段的旧会话照常加载；无 apiLen 的旧消息分叉降级为空上下文
const { convSet } = await import('../src/core/idb.js')
await convSet('cv_legacy', JSON.stringify({
  id: 'cv_legacy', title: '老会话', subject: 'auto', createdAt: 1, updatedAt: Date.now(),
  items: [{ id: 42, kind: 'user', text: '老消息' }],
  apiMessages: [{ role: 'user', content: '老消息' }],
}))
await session.loadConversations()
const legacy = session.getConversation('cv_legacy')
ok('老记录默认值齐（chat/gen0/未冻结/无父）', legacy.kind === 'chat' && legacy.gen === 0 && legacy.frozen === false && legacy.parentId === null)
const lkid = session.forkConversation('cv_legacy', 42)
ok('老消息无 apiLen：分叉只带转写不炸', lkid.items.length === 1 && lkid.apiMessages.length === 0)
session.deleteConversation(lkid.id)
srvM1.close()

// ── M2 · 弱点表生效：抽查闭环 + 同源注入 + 补习定稿（工具层 E2E）──
const { createTools } = await import('../src/core/tools.js')
const twTool = createTools(store).find((d) => d.name === 'tutor_weakness')
const texec = async (a) => JSON.parse(await twTool.execute(a))
const wk = store.addWeakness({ subject: 'physics', node: '动量定理', quote: '冲量不会算', src: 'conv:m2', source: 'explore' })
const openR = await texec({ action: 'verify', id: wk.id })
ok('verify 开抽查 → verifying + 出「1 道诊断题」指令', openR.status === 'verifying' && openR.instruction.includes('1 道诊断题'))
ok('跳档被状态机拒绝（verifying 不能 remedy 定稿）', (await texec({ action: 'remedy', id: wk.id, card: { question: 'x', answer: 'y' } })).ok === false)
const conf = await texec({ action: 'verify', id: wk.id, verdict: 'confirmed', rationale: '冲量与动量变化没搭上', answer: 'F=ma' })
ok('判 confirmed → remedying 进补习队列（overview 同源）', conf.status === 'remedying' && store.overview().remedyQueue.some((r) => r.id === wk.id))
// 同源注入：下一轮 system 必须带出【补习焦点】与该节点
const seenM2 = []
const srvM2 = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    seenM2.push(String(parsed.messages[0].content))
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '好' } }] }))
  })
})
await new Promise((r) => srvM2.listen(0, '127.0.0.1', r))
llm.saveAiConfig({ baseUrl: 'http://127.0.0.1:' + srvM2.address().port + '/v1', model: 'stub', apiKey: 'x' })
session.newConversation()
await session.sendUser('今天学点什么', [])
const sysLast = seenM2[seenM2.length - 1]
ok('补习焦点注入 system（闸门后才同源，D1①）', sysLast.includes('【补习焦点】') && sysLast.includes('动量定理'))
ok('待验证信号不直接注入只报个数（防污染）', sysLast.includes('待验证'))
const finR = await texec({ action: 'remedy', id: wk.id, card: { question: '冲量怎么算、和动量什么关系', answer: 'I=Ft；动量定理 I=Δp（矢量式）', explanation: '先定过程再选方向' } })
const cardItem = store.db().items.find((i) => i.seedKey === 'weakness:' + wk.id)
ok('remedy 定稿 → mastered + 卡入排期（走现有 newSrs，不改调度常量）', finR.status === 'mastered' && Boolean(cardItem) && cardItem.kind === 'card' && cardItem.srs.state === 'new')
ok('定稿后离开补习队列', !store.overview().remedyQueue.some((r) => r.id === wk.id))
const wkB = store.addWeakness({ subject: 'math', node: '复数的模', quote: 'q' })
await texec({ action: 'verify', id: wkB.id })
await texec({ action: 'verify', id: wkB.id, verdict: 'confirmed', rationale: 'r' })
const dismissedRec = store.setWeaknessStatus(wkB.id, 'invalid', { resolution: { kind: 'dismiss', verdict: 'irrelevant', note: '用户在补习队列点这不相关' } })
const stM2 = store.weaknessStats()
ok('H4 驳回可采（dismissed/invalidRate/dismissRate 都是数）', dismissedRec.status === 'invalid' && stM2.dismissed >= 1 && Number.isFinite(stM2.invalidRate) && Number.isFinite(stM2.dismissRate))
// 注：srvM2 留到 M3 段一起用（system 捕获），文件末尾统一关

// ── M3 · A 环闭环：拍题→goal→学→交→评分→补习→回流→定稿（工具层 E2E + 交集注入）──
const taskTool = createTools(store).find((d) => d.name === 'tutor_task')
const xexec = async (a) => JSON.parse(await taskTool.execute(a))
const cr = await xexec({ action: 'create', goal: '搞定这套导数题', subject: 'math', nodes: ['复合函数的求导法则'], plan: ['过例题', '独立做 3 题'], materials: ['已知 f(x)=sin(x²)，求 f′', '讨论单调性'] })
ok('A 环 create：tk_ 任务 + A₁ + 计划', cr.ok === true && /^tk_/.test(cr.id) && cr.plan.length === 2)
ok('create 缺材料被拒（A₁ 是源头）', (await xexec({ action: 'create', goal: 'x', nodes: ['n'], plan: ['p'], materials: [] })).ok === false)
const noConf = await xexec({ action: 'finish', id: cr.id, confirmedByUser: false, cards: [{ question: 'q', answer: 'a' }] })
ok('D4 护栏：confirmedByUser 不为 true 拒定稿', noConf.ok === false && noConf.error.includes('D4'))
await xexec({ action: 'submit', id: cr.id, deliverable: '第一题 f′=cos(x²)·2x 对了，第二题忘了乘内层' })
const gr = await xexec({ action: 'grade', id: cr.id, score: 70, full: 100, comment: '链式不稳', gaps: [{ node: '复合函数的求导法则', quote: '第二题忘乘内层' }] })
ok('grade：gaps 进弱点表（source=grade）', gr.ok === true && gr.newGaps.length === 1)
const gapW2 = store.getWeakness(gr.newGaps[0].weaknessId)
ok('A×B 双源并档升置信（D1③：同 node 的 explore+grade）', gapW2.sources.length === 2 && gapW2.confidence > 0.5)
const wkC = store.addWeakness({ subject: 'physics', node: '机械波', quote: '不会画波形' })
await texec({ action: 'verify', id: wkC.id })
await texec({ action: 'verify', id: wkC.id, verdict: 'confirmed', rationale: 'r' })
session.newConversation()
await session.sendUser('任务进行中先学啥', [])
const sysM3 = seenM2[seenM2.length - 1]
ok('【当前任务】注入 system（goal 上膛）', sysM3.includes('【当前任务】') && sysM3.includes('搞定这套导数题'))
ok('交集过滤生效：任务外 remedying 不注入（D1②/D3）', !sysM3.includes('机械波'))
await texec({ action: 'verify', id: gapW2.id })
const jg = await texec({ action: 'verify', id: gapW2.id, verdict: 'confirmed', rationale: '重做仍漏内层', answer: 'cos(x²)' })
ok('gap 走验证闸门进补习队列', jg.status === 'remedying')
session.newConversation()
await session.sendUser('现在优先补什么', [])
const sysM3b = seenM2[seenM2.length - 1]
ok('交集命中：任务节点内的 remedying 注入补习焦点', sysM3b.includes('【补习焦点】') && sysM3b.includes('复合函数的求导法则'))
const remR = await texec({ action: 'remedy', id: gapW2.id, card: { question: '链式法则一句话', answer: '外层导乘内层导' } })
const tNow = store.getTask(cr.id)
ok('remedy mastered 回流：gap 清零 readyToFinish=true', remR.status === 'mastered' && tNow.gaps[0].cleared === true && tNow.readyToFinish === true)
const finOK = await xexec({ action: 'finish', id: cr.id, confirmedByUser: true, summary: '链式过关', cards: [{ question: 'd/dx sin(x²)=?', answer: '2x·cos(x²)', explanation: '漏乘内层是主错' }, { question: 'bad' }] })
const tDone = store.getTask(cr.id)
ok('finish：任务 done + 总结卡入排期（复习库）', finOK.ok === true && tDone.status === 'done' && tDone.cardIds.length === 1 && store.db().items.find((i) => i.id === tDone.cardIds[0]).srs.state === 'new')
ok('定稿后不再计入 activeTaskNodes', JSON.stringify(store.activeTaskNodes() || []).includes('复合函数的求导法则') === false)
srvM2.close()
// ── M4 · 复活与森林：tutor_explore.resume + 第二代档案注入 + 翻案链 ──
const exRec = store.explorationDb().explorations.find((e) => e.convId === kid.id && !e.degraded)
ok('M1 产的四件套档案在（复活的前提）', Boolean(exRec) && exRec.compact.conclusion === ARCHIVE.conclusion)
const teTool = createTools(store).find((d) => d.name === 'tutor_explore')
const teexec = async (a) => JSON.parse(await teTool.execute(a))
const teList = await teexec({ action: 'list' })
ok('tutor_explore list：档案目录可读', teList.total >= 1 && teList.explorations.some((e) => e.id === exRec.id))
const teResume = await teexec({ action: 'resume', id: exRec.id })
ok('tutor_explore resume：四件套+弱点现状+「别复述」指令', teResume.ok === true && teResume.archive.conclusion === ARCHIVE.conclusion && teResume.instruction.includes('别复述'))
const g2 = session.resumeFromExploration(kid.id, exRec.id)
ok('第二代：gen=2 挂在第一代下 + fromExploration 指档案', g2.gen === 2 && g2.parentId === kid.id && g2.fromExploration === exRec.id && g2.kind === 'exploration')
ok('第二代不重放 transcript（只一条承接 notice、上下文空）', g2.items.length === 1 && g2.items[0].kind === 'notice' && g2.apiMessages.length === 0)
const seenM4 = []
const srvM4 = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const parsed = JSON.parse(body)
    seenM4.push(parsed)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '那就从那条没聊完的分支接。' } }] }))
  })
})
await new Promise((r) => srvM4.listen(0, '127.0.0.1', r))
llm.saveAiConfig({ baseUrl: 'http://127.0.0.1:' + srvM4.address().port + '/v1', model: 'stub', apiKey: 'x' })
session.switchConversation(g2.id)
await session.sendUser('上次卡的地方我想再试试', [])
const m4sys = seenM4[0].messages[0]
ok('第二代 system 注入继承存档（结论/卡点/未探索分支都在）', m4sys.role === 'system' && m4sys.content.includes('【上一代探索档案') && m4sys.content.includes(ARCHIVE.conclusion) && m4sys.content.includes('隐函数求导没碰'))
ok('档案注入不重放 transcript（请求里 user 消息仅本轮 1 条）', seenM4[0].messages.filter((m) => m.role === 'user').length === 1)
const live = store.listWeaknesses({ status: 'remedying' }).weaknesses[0]
const ov = await texec({ action: 'dismiss', id: live.id, note: '第二代抽查证明当时就会，上代记录系误报', overturn: true })
ok('翻案链：dismiss{overturn:true} → invalid + overturned 计数', ov.status === 'invalid' && store.weaknessStats().overturned >= 1)
await new Promise((r) => setTimeout(r, 700))
await session.loadConversations()
const g2r = session.getConversation(g2.id)
ok('重启后树不塌：第二代字段三处同步在线', g2r.gen === 2 && g2r.parentId === kid.id && g2r.fromExploration === exRec.id)
srvM4.close()

bad.close()
server.close()

console.log('')
if (failures.length > 0) { console.error('AI 链路失败 ' + failures.length + ' 项'); process.exit(1) }
console.log('✅ AI 工具循环端到端通过 ' + passed + ' 项')