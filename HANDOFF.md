# UtaNote 项目接续说明（贴给新会话的第一条消息）

我在延续一个已经进行了一段的项目。请先读完这份说明再动手；除非我另外要求，不要重写已完成的部分。

## 项目是什么

UtaNote —— 一个「把一首日语歌拆成可学会的每一句」的日语学习 App。
源头是 Claude Design 导出的 HTML 交互原型（iOS 深色 UI，紫色强调色
`#8489e0` / `#a5a8ec`，字体 Noto Serif/Sans SC）。原型有 5 个屏 + 底部四标签 + 词语详情弹层：
首页(粘贴歌词导入) → 今日任务 → 逐句卡片(高亮词 + 整句语法结构 token chips + 可展开假名/罗马音)
→ 学习总结 → 词库 / 我的。已按原型**像素级**实现，并接上了真实的歌词解析闭环。

## 现在有两套实现（都已完成、可运行）

- **`app/`** —— Vite + React 18 的 **Web 版**（验证需求用）。
- **`miniapp/`** —— Taro(React) + **微信云开发** 的**小程序版**（正式首发入口）。

两套**逻辑/数据同源**，刻意做了三层解耦，便于共享与迁移。

## 架构（关键：逻辑层与 DOM 无关）

```
data.js            静态演示数据(《月灯りのメロディー》4句) + sampleLyrics
useUtaNote.js      逻辑层：全部 useState + 派生值 + 动作(含异步解析)。零 JSX / 零 DOM
App.jsx/index.jsx  视图层：只消费 hook 渲染
IOSDevice.jsx      仅 Web 的原型外壳(灵动岛/状态栏)，小程序丢弃
```

## 歌词解析闭环（混合方案，核心）

粘贴任意日文歌词 → 变成学习卡片。管线：
1. **本地(离线、无需 Key)**：`Intl.Segmenter`(浏览器/Node 内置 ICU 分词) 做**分词**，
   `wanakana` 做假名⇄罗马音。
2. **LLM(OpenAI 兼容，如 DeepSeek)**：补**汉字读音、中文翻译、整句语法结构、逐词角色、生词详情**。
3. **无 Key**：只跑本地分词，出占位草稿(流程可演示)；导入内置示例歌词则返回手工精修的演示数据。

**协议 = OpenAI 兼容 `/v1/chat/completions`**，`response_format: json_object`。默认厂商 DeepSeek。

**每句(sentence)的数据结构**（本地和 LLM 产出都必须是这个形状）：
```js
{ num, label, status, original, highlightWord, furigana, romaji, translation, structure,
  tokens: [{ text, reading, role, type }],           // type: 'content' | 'particle'
  tips:   [{ main, label }],
  detail: { word, kana, romaji, pos, meaning, grammar, formula, tags[], example:{jp,cn} } }
```

## Web 版关键文件(`app/src/`)

- `parseLyrics.js` —— 编排本地+LLM，产出 sentence[]；无 Key 走 mock，示例歌词走 demo 捷径
- `nlp/segment.js` —— 本地分词/假名/罗马音（**升级位**：换 kuromoji.js 可离线出汉字读音，代价 ~5MB 词典）
- `llm/client.js` —— OpenAI 兼容 fetch 客户端（含 CORS/401/403/404/429 中文错误提示）
- `config/settings.js` —— baseURL/apiKey/model 存 localStorage
- `store/library.js` —— 导入歌曲连同解析结果存 localStorage
- `App.jsx` / `useUtaNote.js` / `data.js` / `IOSDevice.jsx`
- 设置入口在 **我的 → AI 解析设置**。默认占位 `https://api.deepseek.com/v1` + `deepseek-chat`。
- 单文件预览构建：`vite.singlefile.config.js`（`npx vite build --config vite.singlefile.config.js`）。

## 小程序版关键文件(`miniapp/`)

- `cloudfunctions/parse/index.js` —— **云函数**：自包含 Node 版解析管线（分词+DeepSeek），
  Key 取自云函数环境变量 `DEEPSEEK_KEY`（可选 `DEEPSEEK_BASE`/`DEEPSEEK_MODEL`）。
  无 Key → 本地草稿；LLM 失败 → 自动降级并带 warning。
- `src/logic/parse.js` —— 端上用 `wx.cloud.callFunction('parse')`（**不需要 request 合法域名**）
- `src/logic/settings.js` / `library.js` —— `wx.setStorageSync` 持久化
- `src/logic/useUtaNote.js` —— 从 Web 版几乎照搬
- `src/logic/sx.js` —— 把内联样式对象序列化成 CSS 字符串并自动补 px（复用 Web 版样式值）
- `src/pages/index/index.jsx` —— 整套 UI 用 View/Text/Input/ScrollView 重画（单页，状态驱动切屏）
- `src/app.js` 里 `Taro.cloud.init(...)`；`config/`、`babel.config.js`、`project.config.json`、`package.json`(Taro 3.6.34)

## 运行方式

**Web**：`cd app && npm install && npm run dev`（http://localhost:5173）。
**小程序**：`cd miniapp && npm install && npm run build:weapp` → 微信开发者工具导入 `miniapp/` →
开通云开发 → 右键 `cloudfunctions/parse` 上传并部署(云端安装依赖) → 云函数环境变量加 `DEEPSEEK_KEY` → 预览。
（DeepSeek key 我自己保管，放云函数环境变量或 Web 设置页，**别提交进仓库**。）

## 验证状态（重要，如实）

已验证：
- Web `npm run build` 通过、`preview` 返回 200；`parseLyrics` 的本地/示例/空输入路径在 Node 跑通。
- 云函数在 Node 跑通：本地草稿 / LLM 失败降级 / 空输入 / 数据结构正确。
- 全部 `.js` 过 `node --check`，`index.jsx` 过 esbuild 转译校验。

**未验证（需要你/我在合适环境补）**：
- **真实 DeepSeek 调用没跑过** —— 之前的云端沙盒把 `api.deepseek.com` 加了出网黑名单(403 host_not_allowed)，
  请求到不了 DeepSeek。首次接真 Key 时若 DeepSeek 的 JSON 严格度导致解析偏差，需微调 `parseLyrics.js` / 云函数里的 prompt。
- **小程序 weapp 没在本机编译过**（缺微信开发者工具）；首次 `build:weapp` 若报 Taro 版本相关小问题，按提示微调 `package.json` 版本。

## 已知约束 / 坑（都想清楚了）

- **Web 端 CORS**：浏览器直连 DeepSeek，若 DeepSeek 不返回跨域头，fetch 会失败 → 需要一个支持 CORS 的中转
  (如 Cloudflare Worker，几十行转发)。**尚未实测 DeepSeek 是否放行浏览器 CORS**。
- **小程序不能自填任意 url**：`wx.request` 只能打后台预登记的合法域名 → 已用**云函数**绕过（`wx.cloud.callFunction` 走云端，不受此限）。所以「用户自带 url」在小程序不成立；「用户自带 key」还能做(经云函数透传)。
- **离线汉字读音**：本地只分词，汉字假名读音离线拿不到 → 现交给 LLM。要离线注音就上 kuromoji.js（升级位在 `nlp/segment.js`）。
- **小程序布局用固定 px**（和设计一致），不随机型宽度缩放；要全机型自适应把 `sx.js` 改成输出 rpx。
- 学习总结页/今日任务环上的**部分数字仍是静态演示**（周进度、12/32 掌握等），**尚未做真实进度追踪**。

## Git 状态

仓库 `https://github.com/jane-uske/utanote.git`（我的，之前是空的）。
代码已在上个环境本地 commit（`app/` + `miniapp/`，42 个文件，不含 node_modules/dist），
但那个托管环境的 git 代理对我仓库只有读权限，push 返回 403，所以**要用我自己的 GitHub 凭据推**。
（我可能已经用 `git clone + 解压 tar 包 + push` 自己推上去了；你先 `git status` / 看远端确认当前状态。）

## 接下来可做（按需挑）

1. Web 端 CORS 中转（Cloudflare Worker）+ 实测 DeepSeek 直连
2. 首次接真 Key 后按 DeepSeek 实际返回调 prompt
3. 小程序 UI 改 rpx 全机型自适应
4. 真实学习进度追踪（替换静态数字：已学/掌握度/连续天数）
5. kuromoji.js 离线汉字读音
6. 把两套整进同一 GitHub 仓库并跑通 CI

---

请先 `git status` 和看一遍 `app/`、`miniapp/` 目录与两份 README，确认你拿到的代码状态，再问我要做哪一项。
