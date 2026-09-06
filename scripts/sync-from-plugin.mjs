// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * sync-from-plugin.mjs —— 已退役（2026-09-06 用户拍板，见研究区 PLAN.md §3）。
 *
 * DSH 插件 dsh-highschool-tutor 不再是同步源或交付面：本仓库 src/core/* 从此只在这里
 * 维护。保留本文件只为给历史用户/脚本一个明确提示；不做任何同步，不读写插件仓库。
 * 历史移植机制（正则锚点、字节级复制）见 git 历史与本仓库 README「与插件仓库的关系」。
 */
console.warn('[hst-app] sync-from-plugin 已退役：dsh-highschool-tutor 插件不再是同步源。')
console.warn('[hst-app] src/core/* 只在本仓库（highschool-tutor-app）维护——直接改源码即可。')
process.exit(1)
