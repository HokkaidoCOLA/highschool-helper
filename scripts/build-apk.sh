#!/usr/bin/env bash
# 一键构建 debug APK（需在装有 JDK 17 与 Android SDK 的机器上执行；
# 本机若无环境：先 brew install --cask android-platform-tools 并按提示装 cmdline-tools）。
set -euo pipefail
cd "$(dirname "$0")/.."

command -v java >/dev/null || { echo '缺少 JDK 17：brew install openjdk@17' >&2; exit 1; }
npx vite build
npm i --no-audit --no-fund @capacitor/core@^6 @capacitor/cli@^6 @capacitor/android@^6
npx cap add android || true
npx cap sync android
cd android
./gradlew assembleDebug
echo
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"