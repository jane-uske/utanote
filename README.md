# UtaNote 🎵

**把一首日语歌拆成可学会的每一句**

通过 AI 解析日文歌词，为每句生成注音、翻译、语法讲解和词汇卡片，让你在喜欢的音乐中自然习得日语。

## ✨ 功能特色

- 📝 **粘贴即学** — 粘贴任意日文歌词，AI 自动拆解为逐句学习卡片
- 🔤 **注音标注** — 每个汉字词标注假名读音和罗马音
- 📖 **语法解析** — 整句语法结构可视化，逐词标注语法角色
- 💡 **词汇详解** — 高亮重点词，点击查看释义、词性、例句、变形公式
- 🌐 **中文翻译** — 每句附自然中文翻译
- 🔊 **日语朗读** — 通过本地 VOICEVOX + 云函数生成整句/词块学习音频，生成一次后缓存播放
- 📚 **词库管理** — 自动收录学过的词汇，支持收藏和掌握度筛选
- 🔒 **隐私优先** — 学习数据优先保存在本设备，TTS 音频通过云存储缓存复用

## 📁 项目结构

```
utanote/
├── app/                   Web 版（Vite + React 18）
│   ├── src/
│   │   ├── App.jsx        视图层
│   │   ├── useUtaNote.js  逻辑层（零 DOM 依赖）
│   │   ├── parseLyrics.js 解析管线编排
│   │   ├── data.js        示例歌曲数据
│   │   ├── nlp/           本地 NLP（分词 + 假名）
│   │   ├── llm/           OpenAI 兼容客户端
│   │   └── config/        设置管理
│   └── package.json
│
├── miniapp/               微信小程序版（Taro 3.6 + 云开发）
│   ├── src/
│   │   ├── app.js         入口 + 云开发初始化 + 自动登录
│   │   ├── logic/
│   │   │   ├── useUtaNote.js  逻辑层
│   │   │   ├── parse.js       云函数调用
│   │   │   ├── tts.js         TTS 云函数调用 + 本机播放缓存
│   │   │   ├── auth.js        微信静默登录
│   │   │   ├── library.js     歌曲 + 掌握度持久化
│   │   │   └── sx.js          样式工具（JS 对象 → CSS 字符串）
│   │   └── pages/index/
│   │       └── index.jsx      全部 UI（单页，状态驱动切屏）
│   ├── cloudfunctions/
│   │   ├── parse/             歌词解析云函数（分词 + DeepSeek + 日志 + 限频）
│   │   ├── generateLineTts/   TTS 学习音频资产云函数（缓存 + 限流 + 云存储）
│   │   └── login/             微信静默登录云函数
│   └── package.json
│
├── services/
│   └── local-tts-server/  Mac 本地 VOICEVOX 桥接服务
│
└── README.md
```

## 🏗 架构设计

### 三层解耦（Web / 小程序共享）

| 层 | 文件 | 职责 |
|---|---|---|
| **Data** | `data.js` | 静态示例数据 |
| **Logic** | `useUtaNote.js` | 全部状态 + 派生值 + 动作，**零 JSX / 零 DOM** |
| **View** | `App.jsx` / `index.jsx` | 纯渲染，只消费 hook |

### 歌词解析管线（核心）

```
用户粘贴歌词
    │
    ▼
┌─────────────────────────────────┐
│  本地 NLP（离线，无需 Key）       │
│  · Intl.Segmenter 日语分词       │
│  · wanakana 假名 ⇄ 罗马音转换   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  LLM 增强（DeepSeek）            │
│  · 汉字读音补全                  │
│  · 中文翻译                      │
│  · 语法结构分析                  │
│  · 重点词汇详解                  │
│  · 发音提示                      │
└──────────────┬──────────────────┘
               │
               ▼
          学习卡片 📇
```

**降级策略**：无 API Key → 返回本地分词草稿（流程可用，语义为占位文本）

### 小程序云架构

```
小程序端（Taro）                        云端 / 本地
    │                                   │
    ├─ wx.cloud.callFunction('login') ──▶ 获取 openId，写入 users 集合
    │                                   │
    ├─ wx.cloud.callFunction('parse') ──▶ 分词 + DeepSeek API
    │                                   ├─ 频率限制（5首/天/用户）
    │                                   ├─ Token 用量统计
    │                                   └─ 日志写入 parse_logs 集合
    │
    └─ wx.cloud.callFunction('generateLineTts')
                                        ├─ 查 song_tts_assets / tts_cache
                                        ├─ 命中缓存：直接返回云存储 fileID，不扣额度
                                        ├─ 未命中：经 cloudflared 调 Mac 本地 VOICEVOX
                                        ├─ 上传音频到云存储
                                        └─ 写入全局缓存与生成用量
```

- API Key 只配置在云函数环境变量 `DEEPSEEK_KEY` 中，**小程序端不可见**
- TTS endpoint/token 只配置在 `generateLineTts` 云函数环境变量中，**小程序端不可见**
- `wx.cloud.callFunction` 走微信云通道，**无需配置域名白名单**

### TTS 学习音频资产模型

UtaNote 不把“播放次数”和“生成次数”混在一起：

- 已生成音频播放：不扣额度
- 命中 `tts_cache`：不扣额度
- 平台内容 / 白名单歌曲：新生成不扣用户额度，只受全站保护
- 用户上传歌词：只有真实调用 VOICEVOX 生成新音频资产时，才扣用户资产生成额度
- 同一句文本 + 同一声音 + 同一语速 + 同一引擎版本：全站复用一条 `tts_cache`

## 🚀 快速开始

### Web 版

```bash
cd app
npm install
npm run dev        # http://localhost:5173
```

### 微信小程序版

#### 1. 编译

```bash
cd miniapp
npm install
npm run build:weapp          # 产物输出到 dist/
# npm run dev:weapp          # 开发模式（watch）
```

#### 2. 微信开发者工具

- 导入项目，目录选 `miniapp/`
- AppID 填你自己的小程序 ID

#### 3. 开通云开发

- 工具顶部点 **☁️ 云开发** → 开通环境
- 创建数据库集合：`users`、`parse_logs`、`tts_cache`、`song_tts_assets`、`tts_usage_daily`、`tts_usage_global_daily`（权限按需选「仅创建者可读写」或云函数可写）

#### 4. 部署云函数

- 右键 `cloudfunctions/login` → **「上传并部署：云端安装依赖」**
- 右键 `cloudfunctions/parse` → **「上传并部署：云端安装依赖」**
- 右键 `cloudfunctions/generateLineTts` → **「上传并部署：云端安装依赖」**

#### 5. 配置 DeepSeek Key

- 云开发控制台 → 云函数 `parse` → **配置** → **环境变量**
- 添加 `DEEPSEEK_KEY` = `sk-你的key`
- 云函数超时设置为 **60 秒**

#### 6. 配置 TTS

在云函数 `generateLineTts` 配置环境变量：

```bash
UTANOTE_TTS_ENDPOINT=https://tts.example.com
UTANOTE_TTS_TOKEN=换成一串长随机token
TEXT_MAX_LENGTH=120
DAILY_USER_ASSET_GENERATE_LIMIT=300
DAILY_CUSTOM_TEXT_GENERATE_LIMIT=100
GLOBAL_DAILY_TTS_GENERATE_LIMIT=3000
TTS_REQUEST_TIMEOUT_MS=15000
VOICEVOX_ENGINE_VERSION=voicevox-v1
```

本地 Mac 启动 VOICEVOX Engine 和桥接服务：

```bash
cd services/local-tts-server
export UTANOTE_TTS_TOKEN=同一个长随机token
export VOICEVOX_ENDPOINT=http://127.0.0.1:50021
export VOICEVOX_DEFAULT_SPEAKER=16
export MAX_TTS_CONCURRENCY=1
npm start
```

cloudflared 映射示例：

```yaml
ingress:
  - hostname: tts.example.com
    service: http://localhost:8787
  - service: http_status:404
```

#### 7. 使用

编译预览 → 首页粘贴日文歌词 → **开始拆解** → 进入学习卡片 → 点击 **朗读** 🎉

## 🛠 技术栈

| 技术 | 用途 |
|---|---|
| React 18 | UI 框架（Web + 小程序共用） |
| Vite 5 | Web 构建工具 |
| Taro 3.6 | 微信小程序跨端框架 |
| 微信云开发 | 云函数 + 云数据库 + 云存储 |
| VOICEVOX | 本地日语朗读 TTS |
| cloudflared | 安全暴露本地 TTS 桥接服务给云函数 |
| wanakana | 日语假名 ⇄ 罗马音 |
| Intl.Segmenter | 日语分词（浏览器/Node 内置） |
| DeepSeek | LLM 语义增强（OpenAI 兼容协议） |

## 🔒 隐私说明

- 歌词、收藏、学习进度等用户学习数据优先保存在**本设备本地存储**
- AI 解析仅将歌词文本发送至 DeepSeek 进行语法分析，不关联任何个人信息
- TTS 只上传生成后的学习音频到微信云存储，用于后续缓存播放
- `UTANOTE_TTS_TOKEN` 和本地 TTS 域名只存在于云函数环境变量中，不进入前端代码
- 卸载小程序会删除本地学习数据；云存储缓存需在云开发控制台中按策略清理

## 📱 页面一览

| 页面 | 功能 |
|---|---|
| 🏠 首页 | 粘贴歌词、输入歌名、开始解析 |
| 📋 今日任务 | 解析结果句子列表 |
| 🃏 学习卡片 | 逐句学习（高亮词、语法标注、假名/罗马音、翻译、朗读） |
| 📊 学习总结 | 本次学习概览 |
| 📚 词库 | 词汇浏览（搜索、收藏筛选、掌握度） |
| 👤 我的 | 歌曲管理、删除、设置、关于 |

## 🚧 未来计划

- 🎤 AI 评分带唱 & 教唱模式
- 🎶 歌声合成 / 慢速跟唱模式
- 🎯 每日学习目标与打卡
- 📊 学习数据统计与进度追踪
- 👥 分享成就卡片给好友

## 📄 License

MIT

---

Made with ♡ for Japanese learners
