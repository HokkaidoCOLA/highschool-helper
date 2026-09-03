# 高中助学 · Android / Windows App（PWA）

> 与 DSH 插件 [dsh-highschool-tutor](https://github.com/HokkaidoCOLA/dsh-highschool-tutor) **同等功能**的手机应用：
> 错题本 + 艾宾浩斯间隔复习、知识卡片库、电子试卷/课件导入（切题 + 答案回填）、
> 九种场景的 2D/3D 动态演示（分步解题时间轴）、每日目标与统计、高考倒计时、模考趋势。
> 语 · 数 · 英 · 物 · 化 · 地。GPL-3.0-or-later。

**AI 对话已内置**：聊天是主页——拍照/相册发题给视觉模型识别讲题、📎 拖入或选择
试卷文档解析入库、模型画图直接生成可分步演示的讲题卡、说「抽查我」当场翻卡评分。
模型凭证自备（设置 → AI 接入，OpenAI 兼容端点）；**不接模型时 App 依然是完整的**
复习/题库/演示/资料/统计工具——离线是默认状态，不是降级。

## 快速上手

```bash
npm install
npm run dev       # 开发（http://localhost:5173）
npm test          # 核心回归 26 项 + AI 工具循环端到端 31 项 + UI 冒烟 13 项
npm run build     # 产物在 dist/（gzip 后约 180 KB）
npm run preview   # 本地起静态服务体验构建产物
```

### 手机上直接用（PWA，零安装）

1. 把 `dist/` 放到任意 HTTPS 静态托管（GitHub Pages / 家用 NAS / `vite preview` 反代均可）；
2. 手机 Chrome 打开 → 菜单「添加到主屏幕」→ 获得独立窗口、离线可用的 App；
3. 复习、录题、演示、试卷导入全部工作，断网无影响。

### 出 APK（Capacitor）

```bash
npm run apk       # scripts/build-apk.sh：build → cap add android → assembleDebug
```

需要 JDK 17 + Android SDK（推荐先装 Android Studio）。产物：
`android/app/build/outputs/apk/debug/app-debug.apk`，可直接装到手机。
`android/` 不入库（`.gitignore`），换机器重跑一次脚本即可。

实测记录（macOS arm64、无 Homebrew）：Microsoft Build of OpenJDK 17 tarball + Google commandline-tools 即可，
全程约 4 分钟出包（`BUILD SUCCESSFUL in 3m34s`，APK 3.9 MB，v1+v2 签名校验通过）。
工具链环境变量参考 `scripts/env.example.sh`。

安装到手机：把 APK 传到手机点开安装（允许「安装未知来源应用」），或 USB 调试下 `adb install -r highschool-tutor-debug.apk`。
debug 包用调试密钥签名——分发给他人的正式版需自建 release keystore 并 `assembleRelease`。

### 出 Windows 安装包（Electron）

```bash
npm run win       # scripts/build-win.sh：build → gen-ico → electron-builder --win --x64
                  # macOS/Linux 上即可交叉产出，无需 Windows 机器或 wine
```

产物在 `win-dist/`：**NSIS 安装包**（`highschool-tutor-vX.Y.Z-win-x64-setup.exe`，
安装后开始菜单/桌面快捷方式）与**便携版 exe**（免安装双击即用），未签名（首次运行
Windows 会弹 SmartScreen——「仍要运行」即可；分发量大再考虑购买代码签名证书）。

桌面壳与 APK 同一哲学：**web 层零改动**，差异全部由 `electron/` 壳补齐——

| 能力 | Android（Capacitor） | Windows（Electron 壳） |
|---|---|---|
| 绕 CORS 请求 AI 端点 | CapacitorHttp 原生代理 | preload 把 http(s) `fetch` 透明转发到主进程 `net.fetch`（带中止） |
| 资源加载 | WebView 读 assets | 特权 `app://hst/` 协议直读 asar 内 `dist/`（IndexedDB/localStorage 落稳定安全源） |
| 数据位置 | App 私有目录 | `%APPDATA%\高中助学\`（卸载重装不清库） |
| 离线 | WebView 内置 | 资源随安装包整分发（桌面禁用 service worker） |
| 桌面习惯 | — | 中文原生菜单、输入框右键菜单、Ctrl+±= 缩放、F11 全屏、外链走系统浏览器 |

```bash
npm run desktop   # 在本机（macOS/Linux/Windows）直接跑桌面壳调试
npm run smoke     # 无头冒烟：验证 渲染 / fetch 桥 / IndexedDB / 网络代理 四件套
npm run ico       # 重新生成 electron/build/icon.ico（矢量配方与 PWA 图标同源）
```

### 桌面端 UI 适配（宽屏布局 + 鼠标反馈，同样惠及大屏平板 PWA）

`src/app.css` 末尾「桌面 / 大屏增强」块 + `Chat.jsx` 侧栏资格修正，触发条件
`min-width:900px`（布局）与 `hover:hover + pointer:fine`（鼠标态），手机（含横屏
紧凑布局）与竖屏平板零影响：

- **限宽居中**：单列页内容 ≤860px；聊天消息列 ≤860px；底部胶囊 Dock 收宽 ≤780px 居中；
- **双栏网格**：今日（hero 通栏 + 卡片两列）、复习（左演示画布 sticky + 右翻卡）、
  演示（左画布 + 右样例列表）——与手机横屏那套同构，尺寸放宽；
- **聊天侧栏常驻**：修正 `LAND_MQ` 只认手机横屏的旧口径，桌面横屏「历史对话」侧栏
  默认展开、汉堡键折叠（CSS 媒体查询早已备好，是 JS 门没放行）；
- **鼠标反馈**：按钮/评分块/演示卡/章节行/会话项等全套 hover 态（借力现有 transition）；
- **双滚动条治理**：鼠标环境隐藏触屏专用的 VBar 假滚动条，原生细条接管。

验收：`npm run verify-desktop`（需先 `npx vite preview --port 4317`）——
1240×820 桌面 19 项断言 + 手机横/竖屏回归，截图落 `.preview/desktop/`。

国内网络（GitHub 直连不通）时依赖 Electron 二进制镜像，`.npmrc` 已配好
`electron_mirror=npmmirror`；electron-builder 的 NSIS/winCodeSign 工具链需
`ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`。

## AI 接入

`设置 → AI 接入` 填三项（任意 OpenAI 兼容服务）：

- **baseURL**：如 `https://api.openai.com/v1`（或 DeepSeek/通义/Kimi 等兼容端点）；
- **API Key**：只存本机 localStorage，不进备份、不外传；
- **模型名**：需支持 function calling；**拍照讲题需视觉能力**（gpt-4o、qwen-vl、glm-4v 一类）。

「测试连接」一键自检。App 端复刻了插件的 15 个工具协议（`src/core/tools.js` 由同步脚本
从插件仓库移植），模型每调一次工具都**真实落在本机 Store**：录题排期、翻卡评分、
可视化讲题卡——插件里工具宿主是 DSH，这里换成了 App 自己的 IndexedDB。

APK 内请求经 CapacitorHttp 原生代理，不受 WebView 的 CORS 限制；纯浏览器 PWA 模式直连
第三方端点可能被 CORS 拦（同源部署或装 APK 是正路）。拍照在 Android 上直接拉系统相机
（`capture="environment"`）；浏览器 PWA 走文件选择器。

## 导航

底部八页：**聊天**（默认）· 今日 · 复习 · 题库 · 演示 · 资料 · 统计 · 设置。

## 从 DSH 插件迁移数据

设置页 →「数据与迁移」→「导入备份/插件数据」，一次选中电脑 `~/.dsh/highschool-tutor/` 里的
六个 JSON（`profile / items / reviews / studylog / exams / demos`）即可——题库、复习进度、
演示库、模考成绩原样带过来（文件名与数据结构两边完全一致）。反向：App 的「导出备份 JSON」
可以写回插件数据目录（改名为对应六个文件即可）。

## 与插件仓库的关系（移植机制）

**能字节级照抄的绝不重写**——引擎与算法两边同源：

| 层 | 方式 |
|---|---|
| srs / subjects / syllabus / seed / importer / paper / scene / examples / showcase | `npm run sync` 从插件仓库**字节级复制** |
| canvas 演示引擎 `src/engine/*.browser.js` | 同上（本就是浏览器脚本，一字未改） |
| store.js | 机械移植：node:fs → IndexedDB（`src/core/idb.js`），业务方法逐行一致；新增 `load/flush/exportAll/importAll` |
| zipfs.js / docs.js | 机械移植：Buffer/zlib → Uint8Array/fflate + 原生 TextDecoder（GBK/UTF-16 嗅探能力保留） |
| UI | 全新移动界面（原 client 半边为 DSH 插槽宿主写，形态不同不迁移；组件语义对齐讲题卡/翻卡） |

移植由 `scripts/sync-from-plugin.mjs` 完成：纯逻辑与引擎直接复制；三个 I/O 文件用**正则锚点**改写，
锚点没命中就大声抛错——插件侧重构后同步不会悄悄产出半旧代码。
插件仓库的 `frame-smoke`（128 项 canvas 录制断言）覆盖引擎渲染回归：那边绿 = 这边引擎绿。

## 目录

```
src/core/       移植自插件的核心逻辑（同步脚本管理，含 tools.js 15 个工具）+ idb.js / bytes.js
src/ai/         llm.js —— OpenAI 兼容客户端：多轮工具循环、视觉消息、可中止
src/engine/     演示引擎四件套（复制）+ boot.js（共享 Player 装载、键盘守卫、主题变量）
src/ui/         七页：今日 / 复习 / 题库 / 演示 / 资料 / 统计 / 设置
src/state.js    store 单例 + 数据变更总线
public/         manifest / sw.js / 图标（scripts/gen-icons.mjs 纯 node 生成）
scripts/        sync · test-core · test-ui · gen-icons · gen-ico · build-apk · fixtures
capacitor.config.json   Android 壳配置（webDir: dist）
electron/       Windows/桌面壳：main.cjs（app:// 协议 + net.fetch 代理 + 原生菜单）· preload.cjs（fetch 桥）
electron-builder.yml    Windows 打包配置（nsis + portable）
```

## 已知边界

- 拍照识题依赖所选模型的视觉能力；纯文本模型下图片附件会被告知识别不了；
- 演示库来源 = 内置 9+7 份 + JSON 导入 + **对话中模型实时生成**（tutor_visualize 落卡）；
- iOS 未验证（PWA 本身可用；Capacitor 加 ios 平台即可）；
- 复习翻卡的「翻面前只显题面图示」沿用引擎 q 标记，内置演示大多未打 q 标，翻面前会显示完整基础图——二期接 AI 时会补标注。