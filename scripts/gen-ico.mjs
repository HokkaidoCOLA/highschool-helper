// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 生成 Windows 应用图标 electron/build/icon.ico（纯 node，零依赖）。
 *
 * 矢量配方（蓝底圆角 + 白色翻卡剪影 + 星）与 scripts/gen-icons.mjs 同源复制，
 * 多档尺寸（16…256）以 PNG 压缩条目封入 ICO 容器（Vista+ 原生支持）。
 * 用法：node scripts/gen-ico.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', 'electron', 'build')
mkdirSync(OUT, { recursive: true })

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body)) // PNG 规定 CRC 按大端存（此前误写 LE，CoreGraphics 严格校验会拒读）
  return Buffer.concat([len, body, crc])
}
/** 逐像素回调着色 → RGBA PNG（与 gen-icons.mjs 同一编码器）。 */
function png(size, painter) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let p = 0
  for (let y = 0; y < size; y += 1) {
    raw[p] = 0
    p += 1
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = painter(x, y, size)
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = a
      p += 4
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const BLUE = [47, 109, 246]
const WHITE = [255, 255, 255]
/** 翻卡剪影画刷（复制自 gen-icons.mjs，改动需两边同步）。 */
function cardPainter() {
  return (x, y, s) => {
    const u = x / s
    const v = y / s
    const pad = 0.06
    const radius = 0.18
    const dx = Math.max(pad - u, u - (1 - pad), 0)
    const dy = Math.max(pad - v, v - (1 - pad), 0)
    const corner = (() => {
      const cx = Math.max(Math.abs(u - 0.5) - (0.5 - radius), 0)
      const cy = Math.max(Math.abs(v - 0.5) - (0.5 - radius), 0)
      return Math.hypot(cx, cy) > radius ? 1 : 0
    })()
    if (dx > 0 || dy > 0 || corner > 0) return [0, 0, 0, 0]
    const inCard = u > 0.26 && u < 0.62 && v > 0.3 && v < 0.74
    const inFold = u > 0.6 && u < 0.74 && v > 0.38 && v < 0.78
    if (inCard || inFold) return [...WHITE, 255]
    const sx = u - 0.72
    const sy = v - 0.26
    const star = Math.hypot(sx, sy) < 0.07 && (Math.abs(sx) + Math.abs(sy) < 0.085)
    if (star) return [...WHITE, 255]
    return [...BLUE, 255]
  }
}
/** 多档 PNG → ICO 容器（type=1，条目为 PNG 压缩位图）。 */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // 图标
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const dirs = []
  const blobs = []
  for (const { size, data } of images) {
    const d = Buffer.alloc(16)
    d[0] = size >= 256 ? 0 : size
    d[1] = size >= 256 ? 0 : size
    d[4] = 1 // planes（LE 低字节）
    d[6] = 32 // bitCount（LE 低字节）
    d.writeUInt32LE(data.length, 8)
    d.writeUInt32LE(offset, 12)
    dirs.push(d)
    blobs.push(data)
    offset += data.length
  }
  return Buffer.concat([header, ...dirs, ...blobs])
}

const images = [16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: png(size, cardPainter()) }))
const file = join(OUT, 'icon.ico')
writeFileSync(file, ico(images))
console.log('icon.ico 已生成 →', file, '(' + images.length + ' 档，' + Math.round(ico(images).length / 1024) + ' KB)')
