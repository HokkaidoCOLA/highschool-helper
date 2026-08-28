// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 演示页：内置 9 种类型样例 + 7 份完整讲题演示 + 本地演示库，共享演示器直接挂载。
 * v1 演示的来源是内置样例与 JSON 导入（AI 生成在二期接 API 后由模型产出场景）。
 */
import React from 'react'
import { store, notify } from '../state.js'
import { EXAMPLES, exampleList } from '../core/examples.js'
import { SHOWCASE } from '../core/showcase.js'
import { normalizeScene, sceneSummary, keySteps, KIND_LABELS } from '../core/scene.js'
import { subjectLabel } from '../core/subjects.js'
import { showScene, hideStage } from '../engine/boot.js'
import { downloadText, toast } from './shared.jsx'

export default function Demos() {
  const [current, setCurrent] = React.useState(null)
  const [saved, setSaved] = React.useState(() => store.listDemos({}, false))
  const [query, setQuery] = React.useState('')
  const stageRef = React.useRef(null)
  const [paste, setPaste] = React.useState(false)
  const [pasteText, setPasteText] = React.useState('')

  React.useEffect(() => {
    if (current === null) { hideStage(); return }
    showScene(stageRef.current, current.scene, {})
    window.scrollTo(0, 0)
    return () => hideStage()
  }, [current])

  const openExample = (kind) => {
    const scene = normalizeScene(EXAMPLES[kind]).scene
    setCurrent({ id: 'example:' + kind, title: scene.title, scene })
  }
  const openSaved = (id) => {
    const row = store.getDemo(id)
    if (row !== null) setCurrent(row)
  }
  const importScene = () => {
    try {
      const raw = JSON.parse(pasteText)
      const { scene, warnings } = normalizeScene(raw.scene !== undefined ? raw.scene : raw, { title: raw.title })
      if (scene.objects.length === 0 && scene.kind !== 'html') { toast('没有可绘制对象：' + warnings.join('；')); return }
      store.saveDemo({ title: scene.title, kind: scene.kind, subject: scene.subject, topic: scene.topic, summary: sceneSummary(scene), keySteps: keySteps(scene), scene })
      setSaved(store.listDemos({}, false))
      notify()
      setPaste(false)
      setPasteText('')
    } catch (err) {
      toast('JSON 解析失败：' + String(err && err.message ? err.message : err))
    }
  }
  const removeDemo = (id) => {
    if (!window.confirm('删除这份演示？')) return
    store.deleteDemos([id])
    setSaved(store.listDemos({}, false))
    if (current !== null && current.id === id) setCurrent(null)
    notify()
  }
  const filtered = saved.demos.filter((d) => query === '' || (d.title + d.topic).toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <div ref={stageRef} className="demoHost big" />
      {current !== null ? (
        <div className="card">
          <div className="row">
            <b className="grow">{current.title}</b>
            <span className="hint">{KIND_LABELS[current.scene.kind] || current.scene.kind}</span>
            <button type="button" className="btn ghost" onClick={() => setCurrent(null)}>收起</button>
          </div>
          {current.scene.caption ? <p className="hint">{current.scene.caption}</p> : null}
          <div className="row">
            <button type="button" className="btn" onClick={() => downloadText(current.id + '.json', JSON.stringify({ title: current.title, scene: current.scene }, null, 2), 'application/json')}>导出 JSON</button>
          </div>
        </div>
      ) : (
        <p className="hint">从下面任选一份演示，分步时间轴可点芯片、可自动播放；画布可拖拽旋转/缩放（2D 平移），r 复位、方向键切步、空格播放。</p>
      )}

      <div className="card">
        <h3>九种场景类型样例</h3>
        <div className="demoGrid">
          {exampleList().map((e) => (
            <button type="button" key={e.kind} className="demoCard" onClick={() => openExample(e.kind)}>
              <span className="demoKind">{KIND_LABELS[e.kind]}</span>
              <span className="demoTitle">{e.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>完整讲题演示（六科）</h3>
        <div className="demoGrid">
          {SHOWCASE.map((row) => (
            <button type="button" key={row.id} className="demoCard" onClick={() => setCurrent(row)}>
              <span className="demoKind">{subjectLabel(row.scene.subject || '')}</span>
              <span className="demoTitle">{row.scene.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>本地演示库</h3>
        <div className="row">
          <input className="input grow" placeholder="搜索标题/知识点…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className="btn" onClick={() => setPaste(!paste)}>{paste ? '取消' : '导入场景 JSON'}</button>
        </div>
        {paste ? (
          <div className="row col">
            <textarea className="input tall2" placeholder='粘贴 {"scene": {...}} 或裸场景对象' value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
            <button type="button" className="btn primary" onClick={importScene}>校验并入库</button>
          </div>
        ) : null}
        {filtered.length === 0 ? <p className="hint">还没有保存的演示。上面任选一份，用「导出 JSON」保管，再随时导回。</p> : null}
        {filtered.map((d) => (
          <div className="row v item" key={d.id}>
            <span className="grow" onClick={() => openSaved(d.id)}><b className="linkBtn">{d.title}</b> <span className="hint">{d.summary} · {d.steps}步</span></span>
            <button type="button" className="btn danger sm" onClick={() => removeDemo(d.id)}>删</button>
          </div>
        ))}
      </div>
    </div>
  )
}