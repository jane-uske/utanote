# UtaNote — 可交互原型（Web）

从 Claude Design 导出的 `UtaNote Prototype.dc.html` 实现的 React Web 版本。
覆盖核心学习闭环：导入歌词 → 今日任务 → 逐句学习卡片（整句语法结构 + 词语详情）
→ 学习总结，另有 词库、我的 两个辅助页，以及底部四标签切换与词语详情弹层。
均为静态数据模拟，无真实音频 / AI 能力（与原型一致）。

## 运行

```bash
cd app
npm install
npm run dev      # 本地开发
npm run build    # 产物输出到 dist/
npm run preview  # 预览已构建产物
```

## 歌词解析闭环（混合方案，纯前端无后端）

「开始拆解」会把粘贴的歌词变成学习卡片，走**本地 + LLM 混合**管线：

- **本地（离线、无需 Key）**：`Intl.Segmenter`（浏览器内置 ICU 分词）做 **分词**，`wanakana` 做假名⇄罗马音。
- **LLM（用户自带 Key，OpenAI 兼容）**：补 **汉字读音、中文翻译、整句语法结构、逐词角色、生词详情**。
- **无 Key 时**：只跑本地分词，生成带占位文案的草稿（流程可演示）；导入内置示例歌词则返回手工精修的演示数据。

**用户在「我的 → AI 解析设置」填 baseURL / apiKey / model**（存 `localStorage`，只发往用户自己配置的接口）。协议为 OpenAI 兼容 `/v1/chat/completions`，可用 DeepSeek / 通义千问 / Moonshot / OpenAI 等。导入的歌曲连同解析结果存 `localStorage`，刷新不丢。

相关模块：
- `src/config/settings.js` — AI 设置的读写（localStorage）
- `src/nlp/segment.js` — 本地分词 / 假名 / 罗马音（**升级位**：换成 kuromoji.js 可离线出汉字读音，代价是 ~5MB 词典）
- `src/llm/client.js` — OpenAI 兼容客户端（含 CORS / 鉴权错误提示）
- `src/parseLyrics.js` — 编排本地 + LLM，产出 `sentence` schema；无 Key 走 mock
- `src/store/library.js` — 导入歌曲的持久化

> 平台注意：「用户自填任意 url」在 **Web/PWA 成立**；**微信小程序**要求 request 域名预先在后台白名单登记，无法自填任意地址 —— 小程序端需改为固定中转域名。见根目录说明。

## 目录结构（为迁移 Taro 小程序而分层）

代码刻意拆成三层，职责清晰，目的是让日后迁移到 **Taro（微信小程序 + H5）**
时的改动尽可能小：

| 文件 | 职责 | 迁 Taro 时 |
|---|---|---|
| `src/data.js` | 纯数据：句子、词库、语法、示例歌词 | **原样搬**，一行不改 |
| `src/useUtaNote.js` | 逻辑层：全部 `useState` + 派生值 + 事件处理。**零 JSX、零 DOM API** | **原样搬**（Taro 用同一套 React 运行时） |
| `src/App.jsx` | 视图层：只消费 `useUtaNote()` 并渲染标签 | **只重写这一层**：`div/span/textarea/input` → `View/Text/Textarea/Input` |
| `src/IOSDevice.jsx` | Web-only 原型外壳（灵动岛 / 状态栏 / home 条） | **丢弃**（小程序屏幕本身即手机） |
| `src/parseLyrics.js` `src/nlp/*` `src/config/settings.js` `src/store/library.js` | 解析管线 / 本地 NLP / 设置 / 持久化 | **逻辑可搬**；仅需替换平台 API：`fetch`→`wx.request`、`localStorage`→`wx.setStorageSync`、域名走小程序白名单 |
| `src/llm/client.js` | OpenAI 兼容客户端（`fetch`） | 小程序改用 `wx.request` + 固定合法域名 |

## 迁移 Taro 时绕不开的平台限制

- **字体**：`Noto Serif SC / Noto Sans SC` 现在靠 Google Fonts CDN 加载，
  小程序不能这样加载网络字体 —— 需退回系统字体，或打包本地字体子集（中文全量字体很大，通常按需子集）。
- **毛玻璃 / 文字渐变**：`backdrop-filter`、文字渐变小程序不支持，
  紫色玻璃质感需降级为半透明纯色或切图。视觉会与 Web 版略有差别，属平台限制而非还原度问题。
- **事件**：输入框在 Web 用 `onChange` + `e.target.value`；Taro/小程序用 `onInput` + `e.detail.value`。
  这层差异被隔离在 `App.jsx` 视图里（`setLyrics` / `setSearch` 只接收字符串），逻辑层不受影响。

## 长期维护

Taro 是多端框架，一套 Taro 代码同时编译出 **微信小程序 + H5**。迁移完成后，
当前 Vite Web 工程退役，**长期只维护一套 Taro 代码**，不是两套。
