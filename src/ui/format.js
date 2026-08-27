// SPDX-License-Identifier: GPL-3.0-or-later
/** 展示格式化工具（client 版 fmtInterval 的独立移植）。 */

/** 天数 → 中文时长。 @param {number|null|undefined} d @returns {string} */
export function fmtIntervalDays(d) {
  if (d === null || d === undefined || !Number.isFinite(d) || d <= 0) return '当天'
  if (d < 1) return '当天'
  if (d < 2) return '1天'
  if (d < 30) return Math.round(d) + '天'
  if (d < 365) return Math.round(d / 30) + '个月'
  return (d / 365).toFixed(1) + '年'
}
