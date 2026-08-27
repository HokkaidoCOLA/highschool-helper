#!/usr/bin/env bash
# 工具链环境示例（本机路径按需修改；source 本文件后即可跑 gradlew / sdkmanager）
# 本机构建验证于 macOS arm64、无 brew 路径：JDK 用 Microsoft Build of OpenJDK 17 tarball，
# Android SDK 用官方 commandline-tools + sdkmanager。
export JAVA_HOME="$HOME/tools/jdk-17.0.20.1+1/Contents/Home"   # 换成你的 JDK 目录
export ANDROID_HOME="$HOME/tools/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"