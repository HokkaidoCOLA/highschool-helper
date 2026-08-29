# Release

## v0.1.1（2025-08-29）

### Windows 桌面版（Electron 壳，web 层与 APK 同源零改动）

- `highschool-tutor-v0.1.1-win-x64-setup.exe` — NSIS 安装包（桌面+开始菜单快捷方式，可换安装目录）
- `highschool-tutor-v0.1.1-win-x64-portable.exe` — 便携版，免安装双击即用
- 未做代码签名：首次运行 SmartScreen 提示选「仍要运行」
- 数据落 `%APPDATA%\高中助学\`（IndexedDB + localStorage），卸载重装不清库
- 构建：`npm run win`（任意 macOS/Linux 机器交叉产出；GitHub 不通时走 `.npmrc` 里的 npmmirror）
- 冒烟：`npm run smoke`（渲染/fetch 桥/IndexedDB/原生网络代理 四项断言，dev 与 packaged asar 双路通过）
- SHA-256：
  - setup `836a584e8143fb54984e44b0ef02366956c4d012ce96e4f0408788c904aa54ea`
  - portable `53472c8b44053e0b949e51548d0ed584acd3dccdccc0d3f48f7c17624e40b737`

- 聊天区滚动错位修复（fixed 抽屉被拽回文档流事故）+ 高度链守卫测试
- 液态玻璃 v2-v9：悬浮 Dock/输入条、球面透镜折射（BiliPai AGSL 配方移植）、
  实时光源高光（跟手/巡游/陀螺仪）、浓郁背景、设置页 8 滑杆调参
- 左侧导航独立滚动区（overscroll 隔离）
- versionCode 2：与 v0.1.0 同签名，可直接覆盖升级
## v0.1.0

发布日期：2025-08-29 · 对应源码 tag：`v0.1.0`（commit 09d746a 功能面：聊天主页/拍照上传/拖拽解析/复习题库/演示/横屏双区独立滚动）

## 产物

- `highschool-tutor-v0.1.0-release.apk` — **正式签名** release 包（versionCode 1 / versionName 0.1.0，minSdk 22 / target 34）
- `highschool-tutor-debug.apk` — 调试包（debug keystore，功能相同）

## 签名

- keystore：`android/app/hst-release.keystore`（alias `hst`，RSA 2048，有效期 30 年，自签名）
- 参数文件：`android/app/keystore.properties`（口令只存在这里；`android/` 整体 gitignore，**不会入库**）
- 证书 SHA-256：`a328217ecbec3d9a26261736c3045672935b762a966883985f72f26aee2905ca`
- **备份**：`~/tools/hst-keystore-backup/`（keystore + properties 各一份）。丢失 keystore = 以后无法给同一 appId 覆盖升级，请务必另存到网盘/移动硬盘。
- 换机/重建树签名：把备份里的两个文件放回 `android/app/` 即可，`assembleRelease` 自动启用（无 properties 时自动退回默认 debug 签名，不阻塞开发）。

## 重新构建

```bash
export JAVA_HOME=$HOME/tools/jdk-17.0.20.1+1/Contents/Home
export ANDROID_HOME=$HOME/tools/android-sdk
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease --no-daemon
# 产物：android/app/build/outputs/apk/release/app-release.apk
```

## 安装注意

- release 与 debug **签名不同**：手机上要先卸载 debug 版再装 release 版，否则报 INSTALL_FAILED_UPDATE_INCOMPATIBLE。
- 卸载会清掉 App 内的 IndexedDB 数据（题库/会话/复习进度）。导出的 JSON 备份不受影响。
- 未来 v0.1.x 覆盖升级：versionCode 递增（2、3…），同一 keystore 签名即可直接覆盖安装。
