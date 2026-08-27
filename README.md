# 高中助学 · Android App（PWA）

> 与 DSH 插件 [dsh-highschool-tutor](https://github.com/HokkaidoCOLA/dsh-highschool-tutor) **同等功能**的手机应用：
> 错题本 + 艾宾浩斯间隔复习、知识卡片库、电子试卷/课件导入（切题 + 答案回填）、
> 九种场景的 2D/3D 动态演示（分步解题时间轴）、每日目标与统计、高考倒计时、模考趋势。
> 语 · 数 · 英 · 物 · 化 · 地。GPL-3.0-or-later。

**v1 边界**：插件里由对话模型驱动的操作（讲题时录题、AI 画图、聊天抽查）改为界面手动入口与内置内容；
**AI 讲题/出题列为二期**（预留：填自己的 OpenAI 兼容 API Key，App 侧复刻工具协议）。
数据完全存本机（IndexedDB），不联网也不掉功能——离线是默认状态，不是降级。

## 快速上手

```bash
npm install
npm run dev       # 开发（http://localhost:5173）
npm test          # 核心回归 23 项 + UI 冒烟 11 项
npm run build     # 产物在 dist/（gzip 后约 140 KB）
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
src/core/       移植自插件的核心逻辑（同步脚本管理）+ idb.js / bytes.js（应用侧基座）
src/engine/     演示引擎四件套（复制）+ boot.js（共享 Player 装载、键盘守卫、主题变量）
src/ui/         七页：今日 / 复习 / 题库 / 演示 / 资料 / 统计 / 设置
src/state.js    store 单例 + 数据变更总线
public/         manifest / sw.js / 图标（scripts/gen-icons.mjs 纯 node 生成）
scripts/        sync · test-core · test-ui · gen-icons · build-apk · fixtures
capacitor.config.json   Android 壳配置（webDir: dist）
```

## 已知边界

- PDF / 图片导入不做（与插件同口径：转 docx 或等二期接识图）；
- 演示库 v1 的来源 = 内置 9+7 份 + JSON 导入；AI 生成场景在二期；
- iOS 未验证（PWA 本身可用；Capacitor 加 ios 平台即可）；
- 复习翻卡的「翻面前只显题面图示」沿用引擎 q 标记，内置演示大多未打 q 标，翻面前会显示完整基础图——二期接 AI 时会补标注。