// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * sync-from-plugin.mjs —— 把插件仓库（dsh-highschool-tutor）的核心代码移植进 App。
 *
 * 纯逻辑模块（srs/subjects/syllabus/seed/importer/paper/scene/examples/showcase/prompts）与
 * canvas 演示引擎（frame/*.browser.js，本就是浏览器脚本）字节级原样复制；store/zipfs/docs
 * 含 Node 专用写法（node:fs、Buffer、zlib），用正则锚点机械改写（tools.js 亦然：文件路径分支
 * 改为引导走资料页上传）。锚点没命中就抛错——
 * 防止插件侧重构后悄悄同步出半旧代码。UI、engine/boot.js、idb/bytes 等应用侧代码不在范围。
 *
 * prompts.js 是「分科讲解规范」的单一来源：App 端用 buildSystemPrompt（整段 system，带身份
 * 与话题边界），插件端另有 coachSection（注册进宿主 prompt 的短段落）——App 只用前者，
 * 多出来的导出无害，故整文件原样复制、不 fork 副本。
 *
 * 用法：node scripts/sync-from-plugin.mjs [插件仓库路径]（默认 ../dsh-highschool-tutor）
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PLUGIN = resolve(process.argv[2] ?? join(dirname(ROOT), 'dsh-highschool-tutor'))

const VERBATIM_CORE = ['srs.js', 'subjects.js', 'syllabus.js', 'seed.js', 'importer.js', 'paper.js', 'scene.js', 'examples.js', 'showcase.js', 'prompts.js']
const VERBATIM_ENGINE = ['00-core.browser.js', '10-scene2d.browser.js', '20-scene3d.browser.js', '30-shell.browser.js']

mkdirSync(join(ROOT, 'src/core'), { recursive: true })
mkdirSync(join(ROOT, 'src/engine'), { recursive: true })

const report = []

/**
 * 顺序应用 [模式, 替换文本, 说明] 编辑对；替换文本按字面插入（$ 不会被特殊解释）。
 * @param {string} text 原文。
 * @param {Array<[RegExp, string, string]>} edits 编辑表。
 * @param {string} file 文件名（报错定位用）。
 * @returns {string} 改写结果。
 */
function port(text, edits, file) {
  let out = text
  for (const [pattern, replacement, label] of edits) {
    if (!pattern.test(out)) {
      throw new Error('移植锚点失效：' + file + ' 的「' + label + '」没命中——插件侧已改动，请对照更新本脚本')
    }
    out = out.replace(pattern, () => replacement)
  }
  return out
}

function copy(srcRel, dstRel) {
  copyFileSync(join(PLUGIN, srcRel), join(ROOT, dstRel))
  report.push(dstRel)
}
function put(dstRel, text) {
  writeFileSync(join(ROOT, dstRel), text, 'utf8')
  report.push(dstRel + '  [ported]')
}

for (const f of VERBATIM_CORE) copy(join('lib', f), join('src/core', f))
for (const f of VERBATIM_ENGINE) copy(join('lib/frame', f), join('src/engine', f))

// ── store.js：node:fs → IndexedDB。业务方法一字不改，只换 I/O 骨架 ──────────────
let st = readFileSync(join(PLUGIN, 'lib/store.js'), 'utf8')
st = port(st, [
  [/import \{ existsSync, mkdirSync, readFileSync, renameSync, writeFileSync \} from 'node:fs'\nimport \{ homedir \} from 'node:os'\nimport \{ join \} from 'node:path'/,
    "import { idbGetAll, idbSet } from './idb.js'", 'store 导入区'],
  [/ \* 全部数据落在 `\$DSH_HOME\/highschool-tutor\/\`（默认 `~\/\.dsh\/highschool-tutor\/\`）：/,
    ' * App 版：六份 JSON 内容整体存放在浏览器 IndexedDB（库 hst-app / 表 files，键 = 文件名）：', 'store 头部目录说明'],
  [/ \* 写入一律「临时文件 \+ rename」原子替换，避免进程被杀时留下半个 JSON。/,
    ' * 渲染前先 await store.load() 水合进内存缓存，业务方法保持与插件版一致的同步签名；', 'store 头部写入说明一'],
  [/ \* host 进程是这些文件的唯一写者，因此读到内存后即缓存，写时同步回盘。/,
    ' * 写入即更新缓存并异步落盘（失败只告警），await store.flush() 可等待全部写完。', 'store 头部写入说明二'],
  [/export function dataDir\(\) \{[\s\S]*?\n\}/,
    "export function dataDir() {\n  return '本机浏览器存储（IndexedDB · hst-app）'\n}", 'dataDir'],
  [/ \* @param \{string\} \[dir\] 数据目录，默认 \{@link dataDir\}\(\)。/,
    ' * 浏览器版：持久层为 IndexedDB，无目录概念。', 'store ctor JSDoc'],
  [/  constructor\(dir = dataDir\(\)\) \{[\s\S]*?\n  \}/,
    '  constructor() {\n    /** 文件内容缓存（水合后同步可用）。 */\n    this.cache = new Map()\n    /** 从持久层水合来的原始 JSON 文本。 */\n    this.hydrated = new Map()\n    /** 未完成的落盘写入。 */\n    this.pending = []\n  }\n\n  /** 从持久层加载全部文件（渲染前 await 一次）。 */\n  async load() {\n    const all = await idbGetAll()\n    this.hydrated = new Map(Object.entries(all))\n    this.cache.clear()\n    return this\n  }\n\n  /** 等待所有未完成的落盘写入（备份/退出前调用）。 */\n  async flush() {\n    await Promise.all(this.pending)\n    this.pending = []\n  }', 'constructor'],
  [/  read\(name, fallback\) \{[\s\S]*?\n  \}/,
    "  read(name, fallback) {\n    if (this.cache.has(name)) return this.cache.get(name)\n    let value\n    try {\n      const raw = this.hydrated.get(FILES[name])\n      value = raw === undefined ? fallback() : JSON.parse(raw)\n      if (value === null || typeof value !== 'object') value = fallback()\n    } catch {\n      value = fallback() // 数据损坏：不让整个应用挂掉，回到空库\n    }\n    this.cache.set(name, value)\n    return value\n  }", 'read'],
  [/ \* 原子写回一个数据文件。/, ' * 更新缓存并异步落盘一个数据文件。', 'write JSDoc'],
  [/  write\(name, value\) \{[\s\S]*?\n  \}/,
    "  write(name, value) {\n    this.cache.set(name, value)\n    const text = JSON.stringify(value, null, 2)\n    const task = idbSet(FILES[name], text).catch((err) => {\n      console.warn('[hst-app] 落盘失败 ' + name + '：' + String(err))\n    })\n    this.pending.push(task)\n    if (this.pending.length > 32) this.pending = this.pending.slice(-16)\n  }", 'write'],
  [/\n\}\n\nexport \{ GRADE_LEVELS/,
    "\n  /** 导出全部数据（备份/迁移；文件名与插件数据目录一致，两边可互转）。 */\n  exportAll() {\n    return {\n      [FILES.profile]: this.profile(),\n      [FILES.items]: this.db(),\n      [FILES.reviews]: this.reviewLog(),\n      [FILES.studylog]: this.studyLog(),\n      [FILES.exams]: this.examDb(),\n      [FILES.demos]: this.demoDb(),\n    }\n  }\n\n  /**\n   * 从备份对象导入（按文件名整体替换；值可为 JSON 字符串或已解析对象）。\n   * @param {Record<string, any>} data 文件名 → 内容。\n   * @returns {{replaced: string[], skipped: string[]}} 结果。\n   */\n  importAll(data) {\n    const byFile = new Map(Object.entries(FILES).map(([k, f]) => [f, k]))\n    const replaced = []\n    const skipped = []\n    for (const [file, raw] of Object.entries(data === null || typeof data !== 'object' ? {} : data)) {\n      const name = byFile.get(file)\n      if (name === undefined) { skipped.push(file); continue }\n      let value = raw\n      if (typeof value === 'string') { try { value = JSON.parse(value) } catch { skipped.push(file); continue } }\n      if (value === null || typeof value !== 'object') { skipped.push(file); continue }\n      this.write(name, value)\n      replaced.push(file)\n    }\n    return { replaced, skipped }\n  }\n}\n\nexport { GRADE_LEVELS", 'store 类尾追加'],
], 'store.js')
st = st.replace(/@param \{string\} name FILES 的键。/g, '@param {string} name FILES 的键。')
if (/node:|Buffer|existsSync|readFileSync\(|writeFileSync\(|mkdirSync|renameSync|homedir/.test(st)) throw new Error('store.js 移植后仍残留 Node 写法，检查锚点')
put('src/core/store.js', st)

// ── zipfs.js：Buffer/zlib → Uint8Array/fflate ─────────────────────────────────
let zp = readFileSync(join(PLUGIN, 'lib/zipfs.js'), 'utf8')
zp = port(zp, [
  [/import \{ inflateRawSync \} from 'node:zlib'/,
    "import { inflateSync } from 'fflate'\nimport { isBytes, u16, u32, utf8Range, utf8All } from './bytes.js'", 'zipfs 导入'],
  [/极简 ZIP 读取器（只用 node 内置 zlib，零依赖）。/, '极简 ZIP 读取器（浏览器版：DEFLATE 走 fflate，其余与插件仓库逐行对应）。', 'zipfs 标题'],
   [/^ \* `zlib\.inflateRawSync`。$/m,
    ' * 后者对应 fflate 的 inflateSync()。', 'zipfs zlib 提及'],
  [/^\/\*\* 单个条目解压后的体积上限/m,
    "function inflateLimit(raw) {\n  const out = inflateSync(raw)\n  if (out.length > ENTRY_CAP) throw new Error('解压结果超过 ' + (ENTRY_CAP / 1024 / 1024) + ' MB 上限')\n  return out\n}\n\n/** 单个条目解压后的体积上限", 'inflateLimit 插入'],
  [/return readEntry\(buf, entry\)\.toString\('utf8'\)/, 'return utf8All(readEntry(buf, entry))', 'zipfs text() 解码'],
  [/if \(entry\.method === 0\) return Buffer\.from\(raw\)/, 'if (entry.method === 0) return raw', 'STORED 分支'],
  [/if \(entry\.method === 8\) return inflateRawSync\(raw, \{ maxOutputLength: ENTRY_CAP \}\)/, 'if (entry.method === 8) return inflateLimit(raw)', 'DEFLATE 分支'],
], 'zipfs.js')
zp = zp.replace(/Buffer\.isBuffer\((\w+)\)/g, 'isBytes($1)')
zp = zp.replace(/buf\.readUInt32LE\(([^)]*)\)/g, 'u32(buf, $1)')
zp = zp.replace(/buf\.readUInt16LE\(([^)]*)\)/g, 'u16(buf, $1)')
zp = zp.replace(/buf\.toString\('utf8', ([^)]*)\)/g, 'utf8Range(buf, $1)')
zp = zp.replace(/@param \{Buffer\}/g, '@param {Uint8Array}')
zp = zp.replace(/@returns \{Buffer\}/g, '@returns {Uint8Array}')
if (/node:|Buffer|readUInt|inflateRaw/.test(zp)) throw new Error('zipfs.js 移植后仍残留 Node 写法')
put('src/core/zipfs.js', zp)

// ── docs.js：Buffer → Uint8Array（TextDecoder 原生支持 GB18030/UTF-16）─────────
let dc = readFileSync(join(PLUGIN, 'lib/docs.js'), 'utf8')
dc = port(dc, [
  [/import \{ isZip, openZip \} from '\.\/zipfs\.js'/,
    "import { isZip, openZip } from './zipfs.js'\nimport { isBytes, utf8All, latin1 } from './bytes.js'", 'docs 导入'],
  [/电子资料的文本抽取层（零依赖，只用 node 内置能力）。/, '电子资料的文本抽取层（浏览器版：编码嗅探走原生 TextDecoder，其余与插件仓库逐行对应）。', 'docs 标题'],
  [/return \{ text: buf\.subarray\(3\)\.toString\('utf8'\), encoding: 'utf-8 \(BOM\)' \}/,
    "return { text: utf8All(buf.subarray(3)), encoding: 'utf-8 (BOM)' }", 'BOM 解码'],
  [/return \{ text: buf\.toString\('utf8'\), encoding: 'utf-8 \(兜底\)' \}/,
    "return { text: utf8All(buf), encoding: 'utf-8 (兜底)' }", '兜底解码'],
], 'docs.js')
dc = dc.replace(/Buffer\.isBuffer\((\w+)\)/g, 'isBytes($1)')
dc = dc.replace(/(\w+)\.toString\('latin1', (\d+), (\d+)\)/g, 'latin1($1, $2, $3)')
dc = dc.replace(/Buffer\.alloc\(0\)/g, 'new Uint8Array(0)')
dc = dc.replace(/@param \{Buffer\}/g, '@param {Uint8Array}')
if (/node:|Buffer\./.test(dc)) throw new Error('docs.js 移植后仍残留 Node 写法')
put('src/core/docs.js', dc)
// ── tools.js：14 个模型工具（schema + 本地执行；文件系统路径分支改道资料页）────
let tl = readFileSync(join(PLUGIN, 'lib/tools.js'), 'utf8')
tl = port(tl, [
  [/import \{ readFileSync \} from 'node:fs'\n/, '', 'tools 导入行'],
  [/buf = readFileSync\(args.path\)/, "throw new Error('App 版请在「资料」页上传文件，或经 text 参数传入文本')", 'tools path 分支'],
], 'tools.js')
if (/node:|readFileSync\(/.test(tl)) throw new Error('tools.js 移植后仍残留 Node 写法')
put('src/core/tools.js', tl)

console.log('同步完成（' + report.length + ' 个文件）← ' + PLUGIN)
for (const r of report) console.log('  · ' + r)