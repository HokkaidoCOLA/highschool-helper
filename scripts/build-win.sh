#!/usr/bin/env bash
# 一键构建 Windows 桌面版（NSIS 安装包 + 便携 exe）。macOS/Linux 上即可交叉产出，无需 wine。
# 依赖：node_modules（npm i）。GitHub 不通时走 npmmirror（可用同名环境变量覆盖）。
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ELECTRON_MIRROR:=https://npmmirror.com/mirrors/electron/}"
: "${ELECTRON_BUILDER_BINARIES_MIRROR:=https://npmmirror.com/mirrors/electron-builder-binaries/}"
export ELECTRON_MIRROR ELECTRON_BUILDER_BINARIES_MIRROR
export electron_config_cache="$PWD/.cache/electron"
export ELECTRON_BUILDER_CACHE="$PWD/.cache/electron-builder"
# 沙箱化终端（HOME 不可写）时打开这一行即可全程可构建：
# export HOME="$PWD/.cache/home" && mkdir -p "$HOME"

npx vite build
node scripts/gen-ico.mjs
npx electron-builder --win --x64

echo
ls -lh win-dist/*.exe
