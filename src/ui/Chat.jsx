// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 主对话页：与学习教练对话，模型直接驱动本地题库/排期/演示（工具在端上执行）。
 *   · 拍照/相册：图片随消息发给视觉模型 → 识别讲题 → 录入错题本
 *   · 📎 文件：docx/pptx/txt/md/csv/html 解析 → 摘要卡 → 「确认入库」
 *   · tutor_visualize 结果 → 演示卡（点开全屏分步演示）
 *   · tutor_review_deck 结果 → 内联翻卡组（当场评分入排期）
 */
import React from 'react'
import { store, notify } from '../state.js'
import { runAssistant, aiReady, loadAiConfig } from '../ai/llm.js'
import { extractText } from '../core/docs.js'
import { parseStudyText } from '../core/paper.js'
import { subjectLabel } from '../core/subjects.js'
import { showScene, hideStage } from '../engine/boot.js'
import { GradeButtons } from './shared.jsx'

let uid = 0
const nextId = () => ++uid

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}

/** 演示卡 → 全屏模态：共享 Player 挂进来，关闭时收回暂存区。 */
function DemoModal({ meta, onClose }) {
  const ref = React.useRef(null)
  React.useEffect(() => {
    if (ref.current) showScene(ref.current, meta.scene, {})
    return () => hideStage()
  }, [meta])
  return (
    <div className="overlay column" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="demoModal">
        <div className="row">
          <b className="grow">{meta.title}</b>
          <button type="button" className="btn sm" onClick={onClose}>关闭（Esc）</button>
        </div>
        <div ref={ref} className="demoModalStage" />
      </div>
    </div>
  )
}

/** 对话里的翻卡组：逐张翻、四档评分直接写排期，「重来」队尾重现。 */
function DeckInline({ cards, onDone }) {
  const [queue, setQueue] = React.useState(cards)
  const [idx, setIdx] = React.useState(0)
  const [revealed, setRevealed] = React.useState(false)
  const againSeen = React.useRef(new Set())
  const item = queue[idx]
  const grade = (g) => {
    if (!item) return
    store.review([{ id: item.id, grade: g, elapsedMs: 0 }])
    notify()
    setQueue((q) => {
      const nq = q.slice()
      if (g === 'again' && !againSeen.current.has(item.id)) { againSeen.current.add(item.id); nq.push(item) }
      return nq
    })
    if (idx + 1 >= queue.length && !(g === 'again' && !againSeen.current.has(item.id))) { onDone && onDone(); return }
    setIdx(idx + 1)
    setRevealed(false)
  }
  if (!item) return <div className="notice">本组翻卡完成 ✔</div>
  return (
    <div className="inlineDeck card">
      <div className="cardMeta">
        <span className="hint">{item.subject ? subjectLabel(item.subject) : ''} {item.topic || ''}</span>
        <span className="hint grow" />
        <span className="hint">{idx + 1}/{queue.length}</span>
      </div>
      <div className="question">{item.question}</div>
      {!revealed
        ? <button type="button" className="btn primary blockBtn" onClick={() => setRevealed(true)}>显示答案</button>
        : <div>
          <div className="answer">{item.answer || '（无答案）'}</div>
          {item.explanation ? <p className="hint">解析：{item.explanation}</p> : null}
          <GradeButtons item={item} onGrade={grade} />
        </div>}
    </div>
  )
}

/** 文件解析摘要卡：确认后才写入题库。 */
function FileCard({ f }) {
  const [state, setState] = React.useState(f.state || 'ready')
  const confirm = () => {
    const list = f.parsed.items.map((it) => ({ subject: it.subject, kind: it.kind, topic: it.topic, question: it.question, answer: it.answer, explanation: it.explanation, tags: it.tags, difficulty: it.difficulty, source: it.source }))
    const r = store.upsertItems(list)
    notify()
    setState('done:' + r.added.length)
  }
  const low = f.parsed.confidence === 'low'
  return (
    <div className="card fileCard">
      <b>{f.name}</b>
      <p className="hint">{f.label} · {f.parsed.mode === 'paper'
        ? '切出 ' + f.parsed.stats.questions + ' 题，' + f.parsed.stats.withAnswer + ' 题匹配到答案' + (f.parsed.stats.answerBlock ? '（含文末答案区）' : '（未见答案区）')
        : '课件转出 ' + f.parsed.stats.cards + ' 张知识卡'}</p>
      {low ? <p className="warn">⚠ 不太像试卷：{(f.parsed.confidenceReasons || []).join('；')}</p> : null}
      <p className="hint">{(f.parsed.items[0] ? String(f.parsed.items[0].question).slice(0, 60) : '')}…</p>
      {state === 'ready'
        ? <button type="button" className="btn primary" onClick={confirm} disabled={low}>确认入库（{f.parsed.items.length} 条）</button>
        : state.startsWith('done:')
          ? <span className="ok">已入库 {state.slice(5)} 条 ✔</span>
          : null}
      {low && state === 'ready' ? <p className="hint">低可信度内容请去「资料」页逐条核对后强制导入。</p> : null}
    </div>
  )
}

export default function Chat({ goSettings }) {
  const [items, setItems] = React.useState([])
  const [input, setInput] = React.useState('')
  const [images, setImages] = React.useState([])
  const [busy, setBusy] = React.useState(false)
  const [modal, setModal] = React.useState(null)
  const apiRef = React.useRef([])
  const abortRef = React.useRef(null)
  const bottomRef = React.useRef(null)
  const camRef = React.useRef(null)
  const galleryRef = React.useRef(null)
  const fileRef = React.useRef(null)
  const cfg = loadAiConfig()

  React.useEffect(() => { bottomRef.current && bottomRef.current.scrollIntoView({ behavior: 'smooth' }) }, [items, busy])
  React.useEffect(() => () => { if (abortRef.current) abortRef.current.abort() }, [])

  const push = (it) => setItems((v) => v.concat([{ id: nextId(), ...it }]))

  const pickImages = async (files) => {
    for (const file of [...(files || [])]) {
      if (!/^image\//.test(file.type || '')) continue
      if (images.length >= 4) break
      const url = await readAsDataUrl(file)
      setImages((v) => v.concat([url]))
    }
  }

  const pickFile = async (files) => {
    const file = files && files[0]
    if (!file) return
    push({ kind: 'notice', text: '正在解析 ' + file.name + ' …' })
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const extracted = extractText(buf, file.name)
      if (!extracted.ok) { push({ kind: 'error', text: extracted.label + ' 不能直接解析：' + (extracted.hint || '') }); return }
      const parsed = parseStudyText(extracted.text, { source: file.name.replace(/\.[a-z0-9]+$/i, '') })
      if (!parsed.items || parsed.items.length === 0) { push({ kind: 'error', text: '没解析出题目。若是知识点整理，可粘贴文本让我录入。' }); return }
      push({ kind: 'file', name: file.name, label: extracted.label, parsed })
    } catch (err) {
      push({ kind: 'error', text: '解析失败：' + String(err && err.message ? err.message : err) })
    }
  }

  const send = async () => {
    const text = input.trim()
    if (busy || (text === '' && images.length === 0)) return
    setInput('')
    const imgs = images
    setImages([])
    push({ kind: 'user', text, images: imgs })
    apiRef.current.push({
      role: 'user',
      content: imgs.length > 0
        ? [{ type: 'text', text: text || '请识别这张图片里的题目并讲解。' }].concat(imgs.map((url) => ({ type: 'image_url', image_url: { url } })))
        : text,
    })
    setBusy(true)
    abortRef.current = new AbortController()
    try {
      const final = await runAssistant(apiRef.current, (ev) => {
        if (ev.phase === 'done') {
          if (ev.meta && ev.meta.kind === 'hst-demo' && ev.ok) push({ kind: 'demo', meta: ev.meta })
          else if (ev.meta && ev.meta.kind === 'hst-deck' && ev.ok) push({ kind: 'deck', cards: ev.meta.items || [] })
          else push({ kind: 'tool', label: ev.label, ok: ev.ok, error: ev.error })
        }
      }, abortRef.current.signal)
      if (final) push({ kind: 'assistant', text: final })
      notify()
    } catch (err) {
      push({ kind: 'error', text: String(err && err.message ? err.message : err) })
      // 出错时回滚本轮未完成的 user 消息不必要——保留在上下文里更利继续对话
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const stop = () => { if (abortRef.current) abortRef.current.abort() }
  const keyDown = (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !/iPhone|Android/i.test(navigator.userAgent)) { ev.preventDefault(); send() } }

  return (
    <div className="chatPage">
      {!aiReady() ? (
        <div className="card aiSetupHint">
          <b>还没有接模型</b>
          <p className="hint">到「设置 → AI 接入」填 baseUrl / model / apiKey（任意 OpenAI 兼容服务），之后这里就能对话讲题、拍照录题；题库、复习、演示等页面不接模型也照常可用。</p>
          <button type="button" className="btn primary" onClick={goSettings}>去设置</button>
        </div>
      ) : null}
      <div className="chatStream">
        {items.length === 0 ? (
          <div className="chatEmpty">
            <p>试试：</p>
            <ul>
              <li>「给我讲讲导数的几何意义，画个图」</li>
              <li>「抽查我 5 道物理」</li>
              <li>「这道题我又错了」＋ 📷 拍照</li>
              <li>📎 丢一份 Word 试卷进来</li>
            </ul>
          </div>
        ) : null}
        {items.map((it) => {
          if (it.kind === 'user') return (
            <div className="msg user" key={it.id}>
              {it.images && it.images.length > 0 ? <div className="msgImgs">{it.images.map((u, i) => <img key={i} src={u} alt="" />)}</div> : null}
              {it.text ? <div className="msgBody">{it.text}</div> : null}
            </div>
          )
          if (it.kind === 'assistant') return <div className="msg assistant" key={it.id}><div className="msgBody">{it.text}</div></div>
          if (it.kind === 'tool') return <div className={'toolLine ' + (it.ok ? '' : 'bad')} key={it.id}>⚙ {it.label}{it.ok ? '' : '（' + it.error + '）'}</div>
          if (it.kind === 'error') return <div className="toolLine bad" key={it.id}>✗ {it.text}</div>
          if (it.kind === 'notice') return <div className="toolLine" key={it.id}>{it.text}</div>
          if (it.kind === 'demo') return (
            <div className="card demoMsg" key={it.id}>
              <div className="row">
                <span className="demoKind">动态演示</span>
                <b className="grow">{it.meta.title}</b>
              </div>
              <p className="hint">{it.meta.summary}</p>
              {(it.meta.keySteps || []).length > 0 ? <p className="hint">★ {(it.meta.keySteps || []).map((s) => s.title).join('；')}</p> : null}
              <button type="button" className="btn primary" onClick={() => setModal(it.meta)}>展开分步演示</button>
            </div>
          )
          if (it.kind === 'deck') return <DeckInline key={it.id} cards={it.cards} />
          if (it.kind === 'file') return <FileCard key={it.id} f={it} />
          return null
        })}
        {busy ? <div className="typing">教练输入中…（可随时停止）</div> : null}
        <div ref={bottomRef} />
      </div>
      {images.length > 0 ? <div className="attachRow">{images.map((u, i) => <img key={i} src={u} alt="" onClick={() => setImages((v) => v.filter((_, j) => j !== i))} />)}</div> : null}
      <div className="composer">
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pickImages(e.target.files); e.target.value = '' }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { pickImages(e.target.files); e.target.value = '' }} />
        <input ref={fileRef} type="file" accept=".docx,.pptx,.txt,.md,.markdown,.csv,.html,.htm" hidden onChange={(e) => { pickFile(e.target.files); e.target.value = '' }} />
        <button type="button" className="iconBtn" title="拍照" onClick={() => camRef.current.click()}>📷</button>
        <button type="button" className="iconBtn" title="相册" onClick={() => galleryRef.current.click()}>🖼</button>
        <button type="button" className="iconBtn" title="文档" onClick={() => fileRef.current.click()}>📎</button>
        <textarea
          className="input grow composerInput"
          rows={1}
          placeholder={cfg.model ? '问点什么，或拍照/丢文件…' : '先接模型（设置→AI 接入）…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={keyDown}
        />
        {busy
          ? <button type="button" className="iconBtn stop" onClick={stop} title="停止">■</button>
          : <button type="button" className="iconBtn send" onClick={send} title="发送">➤</button>}
      </div>
      {modal !== null ? <DemoModal meta={modal} onClose={() => setModal(null)} /> : null}
    </div>
  )
}
