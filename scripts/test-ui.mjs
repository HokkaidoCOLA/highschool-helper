// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * SSR 冒烟：用 esbuild 把 JSX 页面打成 node 可跑的 bundle 再逐页渲染，
 * 抓「引用了不存在的变量 / hook 顺序错 / store 方法漂移」这类构建通得过但一跑就炸的问题。
 */
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const out = join(ROOT, '.test-ui-bundle.mjs')
await build({
  entryPoints: [join(HERE, 'ui-entry.jsx')],
  bundle: true,
  outfile: out,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
  loader: { '.js': 'jsx' },
  logLevel: 'silent',
})
try {
  await import(pathToFileURL(out).href)
} finally {
  const { rmSync } = await import('node:fs')
  rmSync(out, { force: true })
}