# UtaNote · 微信小程序（Taro + 云开发）

把 Web 版原型迁到微信小程序端。UI 用 **Taro（React）** 重画为 `View/Text/Input` 组件;
歌词解析(分词 + DeepSeek)放在 **云函数** 里跑 —— 小程序端一句 `wx.cloud.callFunction`
即可,**不需要配置 request 合法域名**,DeepSeek 的 Key 也不下发到手机。

```
小程序端(Taro) ──wx.cloud.callFunction('parse')──▶ 云函数(Node,自由联网) ──▶ DeepSeek
                                                     ├─ Intl.Segmenter 分词
                                                     └─ Key 取自云函数环境变量 DEEPSEEK_KEY
```

## 目录

```
miniapp/
  src/
    app.js / app.config.js / app.css      入口 + Taro.cloud.init
    data.js                                示例歌曲(演示数据)
    logic/
      useUtaNote.js                        逻辑层(从 Web 版照搬)
      parse.js                             调 parse 云函数
      settings.js / library.js             wx.setStorageSync 持久化
      sx.js                                内联样式对象 → CSS 字符串(自动补 px)
    pages/index/index.jsx                  整个 UI(单页,状态驱动切屏)
  cloudfunctions/
    parse/                                 解析云函数(分词 + DeepSeek)
  config/ babel.config.js project.config.json package.json
```

## 前置条件

- 微信开发者工具(最新版)
- 一个小程序 AppID(mp.weixin.qq.com 注册;个人主体也能用云开发做开发)
- Node 16+(本地构建 Taro 用)

## 跑起来的步骤

**1. 装依赖 + 构建**
```bash
cd miniapp
npm install
npm run build:weapp        # 产物输出到 dist/；开发时用 npm run dev:weapp（watch）
```

**2. 用微信开发者工具打开**
- 导入项目 → 目录选 `miniapp/`(它会读 `project.config.json`,`miniprogramRoot` 指向 `dist/`)。
- AppID 填你自己的(占位是 `touristappid`,仅供无云能力的本地预览)。

**3. 开通云开发**
- 工具顶部点 **「云开发」** → 开通,创建一个环境,记下**环境 ID**。
- 多环境时在 `src/app.js` 的 `Taro.cloud.init({ env: '你的环境ID' })` 填上;单环境可不填。

**4. 部署 parse 云函数**
- 在工具里右键 `cloudfunctions/parse` → **「上传并部署:云端安装依赖」**(这样 `wanakana`/`wx-server-sdk` 在云端自动装,不用本地 install)。

**5. 配置 DeepSeek Key**
- 云开发控制台 → 云函数 `parse` → **环境变量** → 加一条 `DEEPSEEK_KEY = sk-...`。
- (可选)`DEEPSEEK_BASE`(默认 `https://api.deepseek.com`)、`DEEPSEEK_MODEL`(默认 `deepseek-chat`)。

**6. 使用**
- 编译预览 → 首页粘一段日文歌词 → **开始拆解**。云函数返回结构化卡片。
- **没配 Key 也能用**:云函数会返回「本地分词草稿」(读音/释义为占位),流程照样跑通。

## 说明与限制

- **解析限流（发布版）**:每个用户(openid)每天最多解析 **5 首**;单次最多 **5000 字、前 40 行**,单行超 240 字裁剪(前端与云函数双重校验)。
- **LLM 分批**:云函数以 `CHUNK_SIZE=8` 行/批、最大并发 `MAX_CONCURRENCY=4` 分批请求 DeepSeek,批次失败或返回数量异常时自动降级/对齐,不影响其余行。
- **布局用固定 px**(和 Web 设计一致),不是 rpx —— 换机型时尺寸不随宽度缩放。要做全机型自适应,可把 `sx.js` 的数字改成输出 rpx。
- **状态栏**:用了自定义导航(`navigationStyle: custom`),内容顶部留了 44px 安全区,可按需接 `getWindowInfo` 精确适配刘海。
- **Key 安全**:默认走云函数环境变量,端上看不到。设置页里的 Key/地址是**可选覆盖**(留空即用云端配置)。
- **本文件未在本机编译 weapp**(缺微信开发者工具环境)。所有 JS/JSX 已通过语法检查,云函数逻辑已在 Node 跑通(本地草稿 + LLM 失败降级 + 空输入);首次在工具里构建若报个别 Taro 版本相关的小问题,按提示微调 `package.json` 版本即可。

## 与 Web 版的对应

| Web(`app/`) | 小程序(`miniapp/`) |
|---|---|
| `parseLyrics.js` + `nlp/segment.js` | 搬进 `cloudfunctions/parse/index.js`(Node 里 `Intl.Segmenter` 可用) |
| `llm/client.js`(fetch) | 云函数里 `fetch` DeepSeek;端上 `parse.js` 用 `wx.cloud.callFunction` |
| `useUtaNote.js` | 几乎照搬(仅换 storage / parse 来源) |
| `App.jsx`(div/span) | `pages/index/index.jsx`(View/Text) |
| `localStorage` | `wx.setStorageSync` |
| `IOSDevice` 外壳 | 丢弃(真机即手机) |
