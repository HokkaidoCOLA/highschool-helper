// SPDX-License-Identifier: GPL-3.0-or-later
// 浏览器端字节工具：替代插件版里 Buffer 的零星用法（移植后的 zipfs/docs 调用）。
// 约定：所有二进制都用 Uint8Array 表示（node 的 Buffer 本身就是它的子类）。

/** @param {unknown} v @returns {boolean} 是否字节数组。 */
export function isBytes(v) {
  return v instanceof Uint8Array
}

/** @param {Uint8Array} b @param {number} o @returns {number} 小端 16 位无符号。 */
export function u16(b, o) {
  return (b[o] | (b[o + 1] << 8)) >>> 0
}

/** @param {Uint8Array} b @param {number} o @returns {number} 小端 32 位无符号。 */
export function u32(b, o) {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}

const TD_UTF8 = new TextDecoder('utf-8')
const TD_LATIN = new TextDecoder('latin1')

/** @param {Uint8Array} b @returns {string} UTF-8 全文解码。 */
export function utf8All(b) {
  return TD_UTF8.decode(b)
}

/** @param {Uint8Array} b @param {number} s @param {number} e @returns {string} 区间 UTF-8。 */
export function utf8Range(b, s, e) {
  return TD_UTF8.decode(b.subarray(s, e))
}

/** @param {Uint8Array} b @param {number} s @param {number} e @returns {string} 区间 latin1（魔数比对用）。 */
export function latin1(b, s, e) {
  return TD_LATIN.decode(b.subarray(s, e))
}
