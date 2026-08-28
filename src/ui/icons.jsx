// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 图标库：全部内联 SVG（lucide 风格描线，currentColor 随主题）。
 * 从此界面上不再出现 emoji——那是「像原型」的第一元凶。
 */
import React from 'react'

function Svg({ size = 22, children, strokeWidth = 1.8, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {children}
    </svg>
  )
}

export const IconChat = (p) => <Svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 20.5l1.4-4.1A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" /></Svg>
export const IconToday = (p) => <Svg {...p}><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M8 2.5v4M16 2.5v4M3 9.5h18" /><path d="M8.5 14.5l2.2 2.2 4.3-4.3" /></Svg>
export const IconReview = (p) => <Svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v13.5" /><path d="M6.5 18H20v2.5A2.5 2.5 0 0 1 17.5 23h-11A2.5 2.5 0 0 1 4 20.5V6" /><path d="M8.5 8h7M8.5 12h5" /></Svg>
export const IconLibrary = (p) => <Svg {...p}><path d="M4 19.5V5a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v14a2 2 0 0 0-2 2H6a2 2 0 0 1-2-1.5z" /><path d="M20 18a2 2 0 0 1 2 2v1H6.5A2.5 2.5 0 0 1 4 18.5" /><path d="M8 6.5h8M8 10h6" /></Svg>
export const IconDemo = (p) => <Svg {...p}><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 14.5z" /><path d="M9 21h6M12 17v4" /><path d="M10 8.2l4 2.3-4 2.3z" /></Svg>
export const IconDocs = (p) => <Svg {...p}><path d="M14 2.5H6.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V8.5z" /><path d="M14 2.5V8h5.5" /><path d="M8.5 13h7M8.5 16.5h5" /></Svg>
export const IconStats = (p) => <Svg {...p}><path d="M4 20.5V13M10 20.5V4.5M16 20.5v-8M21 20.5H3" /></Svg>
export const IconSettings = (p) => <Svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19 14.5a1.6 1.6 0 0 0 .33 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.33 1.6 1.6 0 0 0-1 1.47V22a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .33-1.77 1.6 1.6 0 0 0-1.47-1H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.33-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.33H8a1.6 1.6 0 0 0 1-1.47V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.33 1.77V8a1.6 1.6 0 0 0 1.47 1H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.47 1z" strokeWidth="1.5" /></Svg>
export const IconCamera = (p) => <Svg {...p}><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.4-2.2h6.6L16.7 6h1.8A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" /><circle cx="12" cy="13" r="3.4" /></Svg>
export const IconImage = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.7" cy="9.5" r="1.6" /><path d="M21 15.5l-4.5-4.2L7 20" /></Svg>
export const IconClip = (p) => <Svg {...p}><path d="M20.5 11.2l-8.6 8.6a5.3 5.3 0 0 1-7.5-7.5l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.5 8.5a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9" /></Svg>
export const IconSend = (p) => <Svg {...p} strokeWidth="2"><path d="M4.5 11.8L20 4.5l-7.3 15.5-1.9-6.3z" /><path d="M20 4.5L10.8 13.7" /></Svg>
export const IconStop = (p) => <Svg {...p} strokeWidth="0"><rect x="7.5" y="7.5" width="9" height="9" rx="2" fill="currentColor" /></Svg>
export const IconSpark = (p) => <Svg {...p}><path d="M12 2.5l2.1 5.6 5.4 1.4-4.4 3.9.4 5.9-3.5-3-3.5 3 .4-5.9L4.5 9.5l5.4-1.4z" /></Svg>
export const IconClock = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2.2" /></Svg>
export const IconFlame = (p) => <Svg {...p}><path d="M12 21a7 7 0 0 0 7-7c0-3.5-2-5.5-3.5-7.5C14 4.5 13.5 3 13.5 3s-1 2-2.5 3.5C9 9 6.5 10.5 6.5 14a5.5 5.5 0 0 0 2 4.5" /><path d="M12 21a3.5 3.5 0 0 0 3.5-3.5c0-2-1.5-3-2.2-4.3-.7 1-1.3 1.8-1.3 3.3a2 2 0 0 1-.6 1.5 3.4 3.4 0 0 0-1.4 2.2A3.4 3.4 0 0 0 12 21z" /></Svg>
export const IconTarget = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" strokeWidth="0" /></Svg>
export const IconLayers = (p) => <Svg {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></Svg>
export const IconRobot = (p) => <Svg {...p}><rect x="4.5" y="8" width="15" height="11" rx="3" /><path d="M12 8V4.5M9 4.5h6" /><circle cx="9.2" cy="13" r="1.1" fill="currentColor" strokeWidth="0" /><circle cx="14.8" cy="13" r="1.1" fill="currentColor" strokeWidth="0" /><path d="M9.5 16.5h5" /><path d="M2 12v3M22 12v3" /></Svg>
export const IconChevron = (p) => <Svg {...p} strokeWidth="2"><path d="M9 5l7 7-7 7" /></Svg>
