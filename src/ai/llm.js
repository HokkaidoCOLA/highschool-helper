// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * OpenAI 兼容聊天客户端（chat completions + tools）。
 *
 * 凭证由用户在设置页填写，存 localStorage（不进备份、不外传）。APK 内请求走
 * CapacitorHttp 原生代理（capacitor.config.json 里 enabled），不受 WebView 的
 * CORS 限制；纯浏览器 PWA 直连第三方端点则可能被 CORS 拦——装 App 是正路。
 *
 * 工具实现直接复用移植自插件的 createTools(store)：模型是大脑，题库/排期/演示
 * 全在本地执行——插件里 14 个工具的宿主从 DSH 换成了 App。
 */
import { store } from '../state.js'
import { createTools } from '../core/tools.js'

const CFG_KEY = 'hst.ai.config'

/** 读 AI 连接配置。 */
export function loadAiConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}')
    return c && typeof c === 'object' ? c : {}
  } catch { return {} }
}

/** 保存 AI 连接配置（baseUrl / apiKey / model / systemPrompt / temperature）。 */
export function saveAiConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
}

/** 是否已配置到可发请求。 */
export function aiReady() {
  const c = loadAiConfig()
  return Boolean(c.baseUrl && c.model)
}

export const DEFAULT_SYSTEM = [
  '你是「高中助学」——面向中国高中生（语数英物化地）的一对一学习教练。',
  '规则：',
  '1. 讲解完一道错题或知识点后，主动调用 tutor_add_items 把值得复习的内容写进题库（topic 用课本口径，可先查 tutor_syllabus）。',
  '2. 凡图形/空间/受力/电路/结构/过程类题目，讲解时调用 tutor_scene_guide（首次画图前）与 tutor_visualize 生成可分步演示的图，并通过 item 参数把题目一并录入。',
  '3. 用户说要复习/抽查时调用 tutor_review_deck；批改后用 tutor_grade_review 回写评分。',
  '4. 收到图片附件时：先完整识别题干文字与图意并复述给用户确认要点，再讲解、录入错题本；识别不确定的地方明确说出来。',
  '5. 用简体中文回答，公式写成可读纯文本（如 f′(x)=3x²−3），先给结论再给步骤，别把整张图复述成文字。',
].join('\n')

function endpoint(cfg, path) {
  return String(cfg.baseUrl || '').replace(/\/+$/, '') + path
}

/** 插件工具定义 → OpenAI function 格式。 */
export function openaiToolDefs(defs) {
  return defs.map((d) => ({ type: 'function', function: { name: d.name, description: d.description, parameters: d.parameters } }))
}

async function callApi(cfg, body, signal) {
  const res = await fetch(endpoint(cfg, '/chat/completions'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (cfg.apiKey || '') },
    body: JSON.stringify(body),
    signal,
  })
  const raw = await res.text()
  let data = null
  try { data = JSON.parse(raw) } catch { /* 非 JSON 的错误体 */ }
  if (!res.ok) {
    const m = data && data.error ? (typeof data.error === 'string' ? data.error : data.error.message) : raw.slice(0, 200)
    throw new Error('模型服务 ' + res.status + '：' + m + (res.status === 401 ? '（检查设置页里的 API Key）' : ''))
  }
  if (!data || !Array.isArray(data.choices)) throw new Error('返回体不含 choices——检查 baseUrl 是否是 chat/completions 的上一级、model 名是否存在')
  return data
}

/** 连接自检：试一次最小 chat 请求（设置页「测试连接」）。 */
export async function testConnection() {
  const cfg = loadAiConfig()
  if (!cfg.baseUrl || !cfg.model) throw new Error('先填写 baseUrl 与 model')
  const data = await callApi(cfg, { model: cfg.model, messages: [{ role: 'user', content: '只回复一个字：好' }], max_tokens: 8 })
  return (data.choices[0].message && data.choices[0].message.content) || '(空响应)'
}

const MAX_TOOL_ROUNDS = 10

/**
 * 跑一轮助手回复：模型调工具就本地执行并回灌，直到给出纯文本或到达轮数上限。
 * @param {object[]} apiMessages 会话消息数组（原地追加，下轮复用）。
 * @param {(ev: object) => void} [onEvent] 过程事件 {type:'tool', name, phase:'run'|'done', label, ok, error, meta}。
 * @param {AbortSignal} [signal] 「停止」按钮的中止信号。
 * @returns {Promise<string>} 最终文本。
 */
export async function runAssistant(apiMessages, onEvent, signal) {
  const cfg = loadAiConfig()
  if (!aiReady()) throw new Error('尚未配置模型：去「设置 → AI 接入」填 baseUrl / model / apiKey')
  if (apiMessages.length === 0 || apiMessages[0].role !== 'system') {
    apiMessages.unshift({ role: 'system', content: cfg.systemPrompt || DEFAULT_SYSTEM })
  }
  const defs = createTools(store)
  const byName = new Map(defs.map((d) => [d.name, d]))
  let rounds = 0
  for (;;) {
    if (signal && signal.aborted) throw new Error('已停止')
    const data = await callApi(cfg, {
      model: cfg.model,
      messages: apiMessages,
      tools: openaiToolDefs(defs),
      temperature: Number.isFinite(Number(cfg.temperature)) ? Number(cfg.temperature) : undefined,
    }, signal)
    const msg = data.choices[0].message
    apiMessages.push(msg)
    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : []
    if (calls.length === 0) return String(msg.content || '')
    rounds += 1
    if (rounds > MAX_TOOL_ROUNDS) return String(msg.content || '（工具调用达到轮数上限，先停在这里）')
    for (const call of calls) {
      const name = call.function && call.function.name
      const def = byName.get(name)
      let args = {}
      try { args = JSON.parse(call.function.arguments || '{}') } catch { /* 坏参数交给工具兜底 */ }
      if (onEvent) onEvent({ type: 'tool', name, phase: 'run', label: toolLabel(name, args) })
      let resultText = '{"ok":false}'
      let meta = null
      let failed = null
      try {
        if (!def) throw new Error('未知工具 ' + name)
        resultText = await def.execute(args)
        try { meta = def.output && def.output.presentationMeta ? def.output.presentationMeta(args, JSON.parse(resultText)) : null } catch { /* 卡片投影失败不影响文本 */ }
      } catch (err) {
        failed = String(err && err.message ? err.message : err)
        resultText = JSON.stringify({ ok: false, error: failed })
      }
      apiMessages.push({ role: 'tool', tool_call_id: call.id, content: resultText })
      if (onEvent) onEvent({ type: 'tool', name, phase: 'done', label: toolLabel(name, args), ok: failed === null, error: failed, meta })
    }
  }
}

/** 工具调用的中文摘要（界面事件行文案）。 */
export function toolLabel(name, args) {
  const a = args || {}
  switch (name) {
    case 'tutor_dashboard': return '查看学情总览'
    case 'tutor_add_items': return '录入题库（' + (a.items ? a.items.length : 0) + ' 条）'
    case 'tutor_search_items': return '检索题库' + (a.query ? '：' + String(a.query).slice(0, 14) : '')
    case 'tutor_review_queue': return '取今日复习队列'
    case 'tutor_review_deck': return '打包复习翻卡（' + (a.limit || 5) + ' 张）'
    case 'tutor_grade_review': return '回写评分（' + (a.grades ? a.grades.length : 0) + ' 条）'
    case 'tutor_study_log': return '记一笔学习'
    case 'tutor_exam_record': return '记录模考成绩'
    case 'tutor_settings': return Object.keys(a).length ? '更新学情设置' : '读取学情设置'
    case 'tutor_import': return a.seed ? '导入内置卡片包' : '批量导入文本'
    case 'tutor_syllabus': return '查知识大纲'
    case 'tutor_visualize': return '绘制动态演示：' + String((a.scene && a.scene.title) || '').slice(0, 24)
    case 'tutor_scene_guide': return '查场景规范' + (a.kind ? '（' + a.kind + '）' : '')
    case 'tutor_paper_import': return '解析电子资料'
    default: return name || '工具'
  }
}
