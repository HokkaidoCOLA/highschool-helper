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
ok('携带 OpenAI tools schema', Array.isArray(requests[0].tools) && requests[0].tools.length === 15 && requests[0].tools[0].function.name === 'tutor_dashboard')
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

bad.close()
server.close()

console.log('')
if (failures.length > 0) { console.error('AI 链路失败 ' + failures.length + ' 项'); process.exit(1) }
console.log('✅ AI 工具循环端到端通过 ' + passed + ' 项')