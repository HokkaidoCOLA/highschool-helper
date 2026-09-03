# Release

## v0.1.1（2025-08-29）

### 桌面端 UI 适配（宽屏布局 + 鼠标反馈；Windows 重打包后生效，大屏平板 PWA 同样受益）

- 宽屏（≥900px）：单列页/聊天消息列限宽 860 居中、Dock 收宽 780 居中；
  今日双列、复习左画布 sticky + 右翻卡、演示左画布 + 右列表（与手机横屏同构）
- 聊天侧栏：`LAND_MQ` 从「手机横屏」修正为「横屏」——桌面/平板横屏历史对话侧栏常驻，
  汉堡键折叠（CSS 媒体查询早已备好，JS 门此前没放行）
- 鼠标环境（hover:hover + pointer:fine）：全套 hover 反馈；隐藏触屏专用 VBar 假滚动条，
  避免与原生条双滚动条
- 手机横屏（max-height:560 紧凑块）与竖屏零影响；验收 `npm run verify-desktop` 19 项断言全绿

### 内置演示修复：斜面上滑块受力分析（examples.js，源头在插件仓库已改并同步）

- 滑块标签曾显示成 "m=m"：示例用 `mass:'m'`，而引擎规则是 `label` 优先、否则渲染 `'m=' + mass`
  → 改 `label:'m'`，正确显示质量符号 m
- 滑块中心 `y:34` 落在斜面上（斜面 x=52 处高 33.4、物块半高 4）→ 上移到 `y:38` 贴合斜面
- 全部力箭头作用点随重心对齐到 (52,38)；摩擦力 f 角度 210°→30°（沿斜面向上，与 G sinθ 反向，
  此前与下滑分力同向属物理错误）
- test-core 白名单护栏改为合成对象直测 mag/mass/label，不再与示例数据强耦合；引擎 frame-smoke 139 项绿

### Windows 桌面版（Electron 壳，web 层与 APK 同源零改动）

- `highschool-tutor-v0.1.1-win-x64-setup.exe` — NSIS 安装包（桌面+开始菜单快捷方式，可换安装目录）
- `highschool-tutor-v0.1.1-win-x64-portable.exe` — 便携版，免安装双击即用
- 未做代码签名：首次运行 SmartScreen 提示选「仍要运行」
- 数据落 `%APPDATA%\高中助学\`（IndexedDB + localStorage），卸载重装不清库
- 构建：`npm run win`（任意 macOS/Linux 机器交叉产出；GitHub 不通时走 `.npmrc` 里的 npmmirror）
- 冒烟：`npm run smoke`（渲染/fetch 桥/IndexedDB/原生网络代理 四项断言，dev 与 packaged asar 双路通过）
- 图标修复：PNG 编码器两个真 bug（CRC 按规范应为大端、CRC 表生成 `>>>1` 误作 `>>>8`，
  gen-icons/gen-ico 同错且 gen-icons 的表 IIFE 还漏了调用括号）——Windows/Chrome 不校验
  PNG CRC 所以旧 icon.ico/PWA 图标带病工作，已修脚本并重生成全部图标
- 已重打包：图标修复 + 演示修复 + 桌面 UI 适配全部打进根目录 exe（2026-08-29 18:08）
- SHA-256（重打包后）：
  - setup `09f7967bf20da742be228ec138c00cfe65032eb8f2ada5ae99abdcdd9554e815`
  - portable `08f2bdb42d45f83579fe96bf97853cb81bc43ddda906d3f3a3b9a645074e8f3e`

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
