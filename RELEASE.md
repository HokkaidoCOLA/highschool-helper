# Release

> 产物管理：所有发布件统一放仓库根目录 `release/`（gitignore，不入库）——每版四件
> （apk release/debug + win setup/portable）+ 同目录 `SHA256SUMS.txt`（shasum -a 256 生成）。

## v0.2.1（2026-09-06）· 词条级探索（Explore 式两段交互）

### 新交互：探索的锚点从「整条消息」下沉到「不懂的那个词」
- 题目/解答里长按（桌面拖动）选中 ≤40 字的词 → 浮出「🌱 探索“X”」→ **速查卡**：
  旁路一次模型调用，≤80 字讲清这个词在当前语境里指什么（定义＋最小例子），不进会话不归档；
  还是堵 → 卡上「🌱 深入探索」→ **词条锚定子会话**（标题=词条；system 约束：先问现有图景、
  一轮一词、解释里冒新词提醒再划词——概念树随划词自然生长）
- **划词即预录弱点**：node=词条、confidence 0.5（用户自认强于 AI 抽取），照旧必须过抽查闸门
  才进补习队列；冻结四件套围绕锚定词产出，同词自动并档（修：auto 会话里学科空白的弱点
  现在会被后续判出学科的信号认领回填，杜绝双账本）
- 第二代「🌱 再开一轮」继承词条锚；不划词时整条消息 🌱 仍是兜底入口（老行为零回归）
- 参考对象：Explore (ai.explore.poker, Dialogus AI) —— child/divergent/branching 三动作中
  后两者由既有消息级分叉与复活覆盖，MindScape 知识地图页仍未做（fan 树为其雏形）

### 工程
- session.js exploreTerm 字段（创建/slim/load 三处同步）；forkConversation 可选锚点参数
- prompts.js 新增 LOOKUP_PROMPT / termLines（单一来源纪律不破）
- 测试 165 → 176 项（速查不占会话 / 并档单记录 / 重启字段 / 词条标题渲染面等 +11）
- versionCode 4：同证书正式签名，覆盖升级不断档

### 产物（release/）
- `highschool-tutor-v0.2.1-release.apk`（3.0M，versionCode 4，证书与 v0.1.0 一致 → 覆盖升级不断档）/ `highschool-tutor-v0.2.1-debug.apk`（3.8M）
- `highschool-tutor-v0.2.1-win-x64-setup.exe`（98M）/ `highschool-tutor-v0.2.1-win-x64-portable.exe`（97M）；未签名惯例不变：SmartScreen 选「仍要运行」
- 发布前冒烟 `npm run smoke` 五断言全绿；`npm test` 三连 176 项全绿
- SHA-256（完整清单见 `release/SHA256SUMS.txt`，含 v0.2.0 历史四件）：
  - apk release `157fabfff58da4ea0b84c89f8a36db36f87da77d76242d6a54dcff73d7162b24`
  - apk debug `3e6a45bffcee563eb442b2e630d7170bca6f15731cacee32452f9c62c6e03a90`
  - win setup `9a6820cd0315712f569827716fe65051d9ccd3fed98768273923325931b6f1fa`
  - win portable `6e266e916dafd083cc37df3ae318d9785e43eaa266be21b003d335689454f724`

## v0.2.0（2026-09-06）· 双环四库全量（M1–M4）

### B 环 · 探索环（对话即采集）
- 消息行「🌱 探索」分叉会话（apiMessages 净口径截断 + tool_calls 配对守卫，分叉上下文可续聊不毒化）；
  探索会话「❄ 这轮完了」冻结归档：一次独立 LLM 调用压出**四件套**（结论/卡点回放/推理链/未探索分支）
  + 弱点被动采集（严格 JSON，解析失败降级只存 transcript、解冻可重试）
- 「🌱 再开一轮」第二代探索：四件套注入 system（不重放 transcript），档案即继承；
  历史对话侧栏平铺列表 → fan 树（缩进 + 连线，冻结只读带 ❄）
- 翻案链：第二代证明第一代误报 → dismiss{overturn} 判 invalid 带证据（resolution.kind=overturn）

### A 环 · 任务环（goal 驱动闭环）
- 新「任务」页签：拍题→goal→计划→交产出→评分→补习→「确定完成」定稿总结卡入复习库，全环走通；
  定稿权在用户（D4）：finish 工具带 confirmedByUser 协议护栏，AI 不能代批

### 弱点注册表（两环唯一汇点）
- 状态机 discovered→verifying→remedying→mastered|invalid + 验证闸门：抽查=按节点出 1 道诊断题、
  文字作答、判案回传（confirmed 进补习队列 / false_positive 判 invalid）
- 「今日」页补习队列（置信度降序 +「这不相关」驳回按钮）；【补习焦点】同源注入 system——
  只注过闸门的，有活跃任务时按任务节点交集过滤；A 做错 + B 卡壳双源命中同 node 置信升
- H1–H4 数据采集就位：weaknessStats（invalid 率/驳回率/翻案数），两周自测口径见研究区 06 篇 §6

### 工程
- store 六表 → 九表（+weaknesses/explorations/tasks，均个人状态数据只存本机·进 E7 导出，不碰冻结中的 HSP 协议）；
  工具 15 → 18（+tutor_weakness/tutor_task/tutor_explore）；新 prompt 全部进 prompts.js 单一来源
- DSH 插件退役处置：删 npm sync 入口、同步脚本改退役提示、用户可见文案自述来源（PLAN §3）
- 测试 77 → 165 项（test-core 58 / test-ai 83 / test-ui 24）；srs.js 调度常量与 spec/ 零改动
- 构建环境注：本机 Android 工具链装于 `.cache/`（Temurin JDK 17 + cmdline-tools + platform 34，
  清华/Google 直连），不进仓库

### 产物
- `highschool-tutor-v0.2.0-win-x64-setup.exe` / `highschool-tutor-v0.2.0-win-x64-portable.exe`（win-dist/，
  未签名：SmartScreen 选「仍要运行」；数据目录 %APPDATA%\高中助学\，覆盖安装不清库）
- Android：`highschool-tutor-v0.2.0-release.apk`（正式签名 hst-release.keystore，
  versionCode 3 / versionName 0.2.0，证书 SHA-256 与 v0.1.0 一致 → 覆盖升级不断档）+
  `highschool-tutor-v0.2.0-debug.apk`（同能，调试用）
- 发布前冒烟：`npm run smoke` 五断言全绿（rendered/bridge/patched/idb/proxy）
- SHA-256（仓库根目录四件）：
  - win setup `c0bf50af44945ea52a168ffaef240ccf4a027507d39e1540182746afcd23dd12`
  - win portable `c37653796984541a94be9253ef219b7041a5e78f8f176eb346784a026a2478fe`
  - apk release `776836a78933897302afb798c13c5b93387a86379bd095ccefc2f8f87accadce`
  - apk debug `df1d2f5d76714025fb57b0d17ef091611ae383bf0d3a5af2f43700075c05d0a8`

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
