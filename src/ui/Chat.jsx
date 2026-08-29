// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 主对话页：视图层。全部会话状态住在 src/ai/session.js（模块单例）——
 * 切页面不打断在途请求，回来历史/草稿/「输入中」原样恢复。
 *   · 拍照/相册：图片随消息发给视觉模型 → 识别讲题 → 录入错题本
 *   · 📎 文件：docx/pptx/txt 等解析 → 摘要卡 → 「确认入库」
 *   · tutor_visualize → 演示卡（点开全屏分步演示）；tutor_review_deck → 内联翻卡组
 */
import React from 'react'
import { store, notify } from '../state.js'
import { aiReady, loadAiConfig } from '../ai/llm.js'
import { getSession, subscribeSession, sendUser, stopUser, clearSession, setDraftText, addDraftImage, removeDraftImage, pushItem, newConversation, switchConversation, renameConversation, deleteConversation, setConversationSubject } from '../ai/session.js'
import { extractText } from '../core/docs.js'
import { parseStudyText } from '../core/paper.js'
import { subjectLabel, SUBJECTS } from '../core/subjects.js'
import { showScene, hideStage } from '../engine/boot.js'
import { GradeButtons } from './shared.jsx'
import ConvDrawer, { ConvPanel } from './ConvDrawer.jsx'
import VBar from './VBar.jsx'
import { IconCamera, IconImage, IconClip, IconSend, IconStop, IconRobot, IconMenu, IconPlus, IconPen, IconTrash } from './icons.jsx'

const SUGGESTS = ['讲讲导数的几何意义，画个图', '抽查我 5 道物理', '这道题我又错了（拍照）', '帮我制定本周复习计划']

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}

/** 订阅会话快照。 */
function useSession() {
  // 第三参 getServerSnapshot：SSR/水合用同一份模块状态（单例，两端一致）
  return React.useSyncExternalStore(subscribeSession, getSession, getSession)
}

/** 演示卡 → 全屏模态：共享 Player 挂进来，关闭时收回暂存区。 */
function DemoModal({ meta, onClose }) {
  const ref = React.useRef(null)
  React.useEffect(() => {
    if (ref.current) showScene(ref.current, meta.scene, {})
    return () => hideStage()
  }, [meta])
  React.useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay column" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="demoModal">
        <div className="row">
          <b className="grow">{meta.title}</b>
          <button type="button" className="btn sm" onClick={onClose}>关闭</button>
        </div>
        <div className="modalStageWrap">
          <div ref={ref} className="demoModalStage" />
          <VBar forRef={ref} />
        </div>
      </div>
    </div>
  )
}

/** 对话里的翻卡组：逐张翻、四档评分直接写排期，「重来」队尾重现。 */
function DeckInline({ cards }) {
  const [queue, setQueue] = React.useState(cards)
  const [idx, setIdx] = React.useState(0)
  const [revealed, setRevealed] = React.useState(false)
  const againSeen = React.useRef(new Set())
  const item = queue[idx]
  const grade = (g) => {
    if (!item) return
    store.review([{ id: item.id, grade: g, elapsedMs: 0 }])
    notify() // 复习流水变了：今日页计数/统计随之刷新（翻卡发生在回合结束后，不能等 finally 的 notify）
    let nq = queue
    if (g === 'again' && !againSeen.current.has(item.id)) { againSeen.current.add(item.id); nq = queue.concat([item]) }
    const next = idx + 1
    setQueue(nq)
    setIdx(next)
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

/** 文件解析摘要卡：确认后才写入题库（seedKey 幂等，重复点不会录两遍）。 */
function FileCard({ f }) {
  const [done, setDone] = React.useState(f.done === true)
  const confirm = () => {
    const list = f.parsed.items.map((it, i) => ({
      subject: it.subject, kind: it.kind, topic: it.topic, question: it.question, answer: it.answer,
      explanation: it.explanation, tags: it.tags, difficulty: it.difficulty, source: it.source,
      seedKey: 'file:' + f.name + ':' + i,
    }))
    const r = store.upsertItems(list)
    setDone(true)
    pushItem({ kind: 'notice', text: f.name + ' 已入库 ' + (r.added.length + r.updated.length) + ' 条，进入复习排期' })
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
      {!done
        ? <button type="button" className="btn primary" onClick={confirm} disabled={low}>确认入库（{f.parsed.items.length} 条）</button>
        : <span className="ok">已入库 ✔</span>}
      {low && !done ? <p className="hint">低可信度内容请去「资料」页逐条核对后强制导入。</p> : null}
    </div>
  )
}

const LAND_MQ = '(orientation: landscape) and (max-height: 560px)'

export default function Chat({ goSettings }) {
  const s = useSession()
  const [modal, setModal] = React.useState(null)
  const [drawer, setDrawer] = React.useState(false)
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  // 横屏（手机横屏/平板）：侧栏与聊天区分栏并列；竖屏：覆盖式抽屉
  const isLandscape = React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(LAND_MQ)
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', cb); else mq.addListener(cb)
      return () => { if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', cb); else mq.removeListener(cb) }
    },
    () => window.matchMedia(LAND_MQ).matches,
    () => false,
  )
  const bottomRef = React.useRef(null)
  const camRef = React.useRef(null)
  const galleryRef = React.useRef(null)
  const fileRef = React.useRef(null)
  const cfg = loadAiConfig()

  React.useEffect(() => { bottomRef.current && bottomRef.current.scrollIntoView({ behavior: 'smooth' }) }, [s.items.length, s.busy])

  const pickImages = async (files) => {
    for (const file of [...(files || [])]) {
      if (!/^image\//.test(file.type || '')) continue
      addDraftImage(await readAsDataUrl(file))
    }
  }

  const pickFile = async (files) => {
    const file = files && files[0]
    if (!file) return
    pushItem({ kind: 'notice', text: '正在解析 ' + file.name + ' …' })
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const extracted = extractText(buf, file.name)
      if (!extracted.ok) { pushItem({ kind: 'error', text: extracted.label + ' 不能直接解析：' + (extracted.hint || '') }); return }
      const parsed = parseStudyText(extracted.text, { source: file.name.replace(/\.[a-z0-9]+$/i, '') })
      if (!parsed.items || parsed.items.length === 0) { pushItem({ kind: 'error', text: '没解析出题目。若是知识点整理，可粘贴文本让我录入。' }); return }
      pushItem({ kind: 'file', name: file.name, label: extracted.label, parsed })
    } catch (err) {
      pushItem({ kind: 'error', text: '解析失败：' + String(err && err.message ? err.message : err) })
    }
  }

  const send = () => {
    const text = s.draftText.trim()
    if (s.busy || (text === '' && s.draftImages.length === 0)) return
    sendUser(text, s.draftImages)
  }

  const keyDown = (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !/iPhone|Android/i.test(navigator.userAgent)) { ev.preventDefault(); send() } }

  return (
    <div className="chatPage">
      <div className="chatSplit">
        <div className={'chatSide' + (sidebarOpen && isLandscape ? '' : ' off')}>
          <ConvPanel
            compact
            convs={s.convs}
            activeId={s.activeId}
            onNew={newConversation}
            onSwitch={switchConversation}
            onRename={renameConversation}
            onDelete={deleteConversation}
          />
        </div>
        <div className="chatMain">
      <div className="chatTop">
        <button type="button" className="iconBtn flat" title="历史对话" onClick={() => (isLandscape ? setSidebarOpen((v) => !v) : setDrawer(true))}><IconMenu /></button>
        <select
          className="input subjPick"
          title="本会话学科"
          value={(s.convs.find((c) => c.id === s.activeId) || { subject: 'auto' }).subject}
          onChange={(e) => setConversationSubject(s.activeId, e.target.value)}
        >
          <option value="auto">自动</option>
          {SUBJECTS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
        <div className="chatTopTitle">{(s.convs.find((c) => c.id === s.activeId) || { title: '新对话' }).title}</div>
        <button type="button" className="iconBtn flat" title="新对话" onClick={newConversation}><IconPlus /></button>
      </div>
      {!aiReady() ? (
        <div className="card aiSetupHint">
          <b>还没有接模型</b>
          <p className="hint">到「设置 → AI 接入」填 baseUrl / model / apiKey（任意 OpenAI 兼容服务），之后这里就能对话讲题、拍照录题；题库、复习、演示等页面不接模型也照常可用。</p>
          <button type="button" className="btn primary" onClick={goSettings}>去设置</button>
        </div>
      ) : null}
      <div className="chatStream">
        {s.items.length === 0 ? (
          <div className="chatEmpty">
            <div className="emptyIcon"><IconRobot size={40} /></div>
            <h2>你的专属学习教练</h2>
            <p>讲题、画图、拍照录错题、丢试卷进来批量入库</p>
            <div className="suggestRow">
              {SUGGESTS.map((t) => (
                <button key={t} type="button" className="suggest" onClick={() => setDraftText(t)}>{t}</button>
              ))}
            </div>
          </div>
        ) : null}
        {s.items.map((it) => {
          if (it.kind === 'user') return (
            <div className="msg user" key={it.id}>
              {it.images && it.images.length > 0 ? <div className="msgImgs">{it.images.map((u, i) => <img key={i} src={u} alt="" />)}</div> : null}
              {it.text ? <div className="msgBody">{it.text}</div> : null}
            </div>
          )
          if (it.kind === 'assistant') return <div className="msg assistant" key={it.id}><div className="msgBody">{it.text}</div></div>
          if (it.kind === 'tool') return <div className={'toolLine ' + (it.ok ? '' : 'bad')} key={it.id}>{it.label}{it.ok ? '' : '（' + it.error + '）'}</div>
          if (it.kind === 'error') return <div className="toolLine bad" key={it.id}>{it.text}</div>
          if (it.kind === 'notice') return <div className="toolLine" key={it.id}>{it.text}</div>
          if (it.kind === 'demo') return (
            <div className="card demoMsg" key={it.id}>
              <div className="row">
                <span className="demoKind">动态演示</span>
                <b className="grow">{it.meta.title}</b>
              </div>
              <p className="hint">{it.meta.summary}</p>
              {(it.meta.keySteps || []).length > 0 ? <p className="hint">★ {(it.meta.keySteps || []).map((k) => k.title).join('；')}</p> : null}
              <button type="button" className="btn primary" onClick={() => setModal(it.meta)}>展开分步演示</button>
            </div>
          )
          if (it.kind === 'deck') return <DeckInline key={it.id} cards={it.cards} />
          if (it.kind === 'file') return <FileCard key={it.id} f={it} />
          return null
        })}
        {s.busy ? <div className="typing">教练输入中…（可随时停止）</div> : null}
        <div ref={bottomRef} />
      </div>
      {s.draftImages.length > 0 ? <div className="attachRow">{s.draftImages.map((u, i) => <img key={i} src={u} alt="" onClick={() => removeDraftImage(i)} />)}</div> : null}
      <div className="composer">
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pickImages(e.target.files); e.target.value = '' }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { pickImages(e.target.files); e.target.value = '' }} />
        <input ref={fileRef} type="file" accept=".docx,.pptx,.txt,.md,.markdown,.csv,.html,.htm" hidden onChange={(e) => { pickFile(e.target.files); e.target.value = '' }} />
        <button type="button" className="iconBtn" title="拍照" onClick={() => camRef.current.click()}><IconCamera /></button>
        <button type="button" className="iconBtn" title="相册" onClick={() => galleryRef.current.click()}><IconImage /></button>
        <button type="button" className="iconBtn" title="文档" onClick={() => fileRef.current.click()}><IconClip /></button>
        <textarea
          className="input grow composerInput"
          rows={1}
          placeholder={cfg.model ? '问点什么，或拍照/丢文件…' : '先到设置接模型…'}
          value={s.draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={keyDown}
        />
        {s.busy
          ? <button type="button" className="iconBtn stop" onClick={stopUser} title="停止"><IconStop /></button>
          : <button type="button" className="iconBtn send" onClick={send} title="发送"><IconSend /></button>}
      </div>
        </div>
      </div>
      {drawer ? <div className="scrim" onClick={() => setDrawer(false)} /> : null}
      <ConvDrawer
        open={drawer}
        convs={s.convs}
        activeId={s.activeId}
        onClose={() => setDrawer(false)}
        onNew={newConversation}
        onSwitch={switchConversation}
        onRename={renameConversation}
        onDelete={deleteConversation}
      />
      {modal !== null ? <DemoModal meta={modal} onClose={() => setModal(null)} /> : null}
    </div>
  )
}