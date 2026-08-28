// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 虚拟滚动条（VBar）：Android WebView 在触屏下忽略 CSS 自定义滚动条（强制 overlay
 * 淡出条，实测 scrollbar-width 生效但 layoutGap=0、截图无条），所以「看得见、拖得动」
 * 的滚动条只能用 DOM 自己画。
 *
 * 用法：滚动容器 position:relative + 挂 ref，容器内放 <VBar forRef={ref} />。
 * 常驻显示（不淡出），thumb 高度按内容比例、位置随滚动同步，支持点轨跳转与拖拽。
 */
import React from 'react'

export default function VBar({ forRef }) {
  const [geo, setGeo] = React.useState({ top: 0, h: 0, visible: false })

  React.useEffect(() => {
    const el = forRef.current
    if (el === null) return
    const update = () => {
      const max = el.scrollHeight - el.clientHeight
      const visible = max > 8
      const track = el.clientHeight - 8
      const h = visible ? Math.max(30, Math.round((el.clientHeight / el.scrollHeight) * track)) : 0
      const top = visible ? 4 + Math.round((el.scrollTop / max) * (track - h)) : 0
      setGeo((g) => (g.visible === visible && g.top === top && g.h === h ? g : { top, h, visible }))
    }
    el.addEventListener('scroll', update, { passive: true })
    let ro = null
    let mo = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update)
      ro.observe(el)
      // 内容子元素（引擎 DOM、消息卡）增高时容器自身尺寸不变，RO 不触发——
      // 必须同时盯住 children 的尺寸变化
      for (const child of el.children) ro.observe(child)
    }
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        if (ro !== null) { for (const child of el.children) ro.observe(child) }
        update()
      })
      mo.observe(el, { childList: true, subtree: true })
    }
    update()
    return () => {
      el.removeEventListener('scroll', update)
      if (ro !== null) ro.disconnect()
      if (mo !== null) mo.disconnect()
    }
  }, [forRef])

  const startDrag = (ev) => {
    const el = forRef.current
    if (el === null || !geo.visible) return
    ev.preventDefault()
    const startY = ev.clientY
    const startScroll = el.scrollTop
    const max = el.scrollHeight - el.clientHeight
    const track = el.clientHeight - 8 - geo.h
    const move = (e) => {
      el.scrollTop = startScroll + ((e.clientY - startY) / Math.max(1, track)) * max
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const jumpTo = (ev) => {
    // 点轨道空白处：按比例跳转（thumb 自身的点击不冒泡到这）
    const el = forRef.current
    if (el === null) return
    const rect = ev.currentTarget.getBoundingClientRect()
    const ratio = (ev.clientY - rect.top - geo.h / 2) / Math.max(1, rect.height - geo.h)
    el.scrollTop = Math.max(0, Math.min(1, ratio)) * (el.scrollHeight - el.clientHeight)
  }

  if (!geo.visible) return null
  return (
    <div className="vbarTrack" onPointerDown={jumpTo}>
      <div className="vbarThumb" style={{ top: geo.top + 'px', height: geo.h + 'px' }} onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} />
      <div className="vbarHit" style={{ top: geo.top + 'px', height: geo.h + 'px' }} onPointerDown={(e) => { e.stopPropagation(); startDrag(e) }} />
    </div>
  )
}