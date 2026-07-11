# UtaNote iOS

从零基础课程进入、再用日语歌巩固的原生 iOS App（Swift + SwiftUI）。核心链路：

今日课程 → 听懂/讲解/测验 → 真人录音反馈 → GPT Live 受控陪练 → 间隔复习 → 用歌曲迁移当天表达。

当前内置“零基础第一月”完整课程包：4 周、24 节，从自我介绍、购物、作息逐步走到问路和 90 秒综合会话。歌曲链路继续保留：选歌 → 沉浸听歌 → 点任意一句 → 假名/翻译/词汇/语法/情绪 → 跟读 → 收藏复习。

## 跑起来

```bash
brew install xcodegen          # 如未安装
cd ios
xcodegen generate              # 由 project.yml 生成 UtaNote.xcodeproj
open UtaNote.xcodeproj         # Xcode 里选 iPhone 模拟器直接 Run
```

命令行构建/测试（本机 Xcode 在 /Applications/Xcode-beta.app 时）：

```bash
export DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer
xcodebuild -project UtaNote.xcodeproj -scheme UtaNote \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcodebuild test -project UtaNote.xcodeproj -scheme UtaNote \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO
```

截图/调试直达路由（模拟器）：

```bash
xcrun simctl launch booted com.rare.utanote --uta-route player --uta-demo-data
# 路由: home | course | lesson | library | review | notebook | player | study | practice | onboarding
# --uta-demo-data 会幂等地播种少量演示用户数据
```

## 架构

```
Sources/
  App/            UtaNoteApp（SwiftData 容器）· AppModel（全局状态/DI）· RootView（Tab+路由）· MiniPlayerBar
  DesignSystem/   Theme（和纸×墨×朱印×藍色板）· Typography（明朝体歌词字体）· Haptics
    Components/   RubyText（假名注音排版）· FlowLayout · CoverArtView（生成式唱片封面）
                  SealStamp（朱印收藏）· UtaKit（卡片/按钮/波形/评分环…）
  Domain/         SongModels（内容包 Codable 模型 + LyricTimeline 二分定位）· SongLibrary（bundle 加载）
  Data/           UserData（SwiftData: 收藏/复习卡/跟读记录/进度 + Leitner 调度 + UserDataStore）
  Services/       AudioPlayerController（AVAudioPlayer+时间轴+后台播放+锁屏控制）
                  SpeechService（ja-JP TTS）· RecordingController（录音+电平）
                  PronunciationEvaluator（SFSpeechRecognizer 识别→罗马字对齐打分，协议可换服务端 AI）
  Features/       Course（24课/测验/Live/课程复习）· Home · Library · Player（夜舞台）· Study（单句学习）
                  Practice（跟读反馈）· Review · Notebook · Onboarding
Resources/
  Songs/*.json    3 首原创演示歌内容包（schema: scripts/ios/SONG_SCHEMA.md）
  Audio/*.m4a     原创合成伴奏（scripts/ios/make_audio.py 按和弦谱确定性渲染）
```

## 设计语言

- 和纸底 `#F6F4EF`（暗色 `#191719`）+ 墨色文字；**朱色只出现在“印章时刻”**（收藏、录音）；藍鉄色承担常规交互。
- 日文展示一律 Hiragino Mincho ProN（明朝体），中文 UI 走系统字体。
- 签名交互：**收藏 = 盖朱印**（缩放盖章动效 + rigid 触觉）；播放器是不随系统外观变化的“夜舞台”，被每首歌的封面色浸染。

## 接入真实服务时改哪里

| 能力 | 现状 | 替换点 |
|---|---|---|
| 歌词分析（假名/翻译/语法/情绪） | 随包 JSON（“AI 分析结果缓存”形态） | `SongLibrary` 换成远端内容源，模型不动 |
| 标准发音 | 设备端 `AVSpeechSynthesizer` | 实现同签名的 TTS 服务替换 `SpeechService` |
| 发音反馈 | 设备端 `SFSpeechRecognizer` + 罗马字对齐；不可用时确定性演示反馈（UI 标注） | 实现 `PronunciationEvaluating` 协议接服务端评估 |
| 曲库 | 3 首原创歌 + 合成伴奏 | 版权接入后替换内容管线；schema 校验器已备 |

API Key 均不落客户端：以上服务层协议就是为服务端中转设计的。

## 内容管线

```bash
python3 scripts/ios/validate_songs.py ios/UtaNote/Resources/Songs/*.json   # schema 校验
python3 scripts/ios/make_audio.py ios/UtaNote/Resources/Songs/*.json \
  --out ios/UtaNote/Resources/Audio                                        # 伴奏渲染
swift scripts/ios/gen_icon.swift <输出.png>                                # App 图标
```
