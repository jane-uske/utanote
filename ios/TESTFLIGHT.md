# UtaNote 1.1.0 内测发布

## 本版本内容

- 零基础第一月：4 周、24 节完整课程；
- 每课包含目标、听读材料、假名、讲解、理解测验、录音评分和 GPT Live 陪练；
- SwiftData 保存课程计划、单课进度、发音记录和课程复习卡；
- 首页以“今日课程”为主入口，同时保留歌曲学习、Apple Music 导入和歌词复习；
- 课程核心句在完成后进入间隔复习；
- 首次启动引导和隐私权限说明已更新；
- 版本号 `1.1.0 (2)`，Bundle ID `com.rare.utanote`。

## 已验证

```bash
cd ios
xcodegen generate

DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
xcodebuild -project UtaNote.xcodeproj -scheme UtaNote \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build-course CODE_SIGNING_ALLOWED=NO test

DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
xcodebuild -project UtaNote.xcodeproj -scheme UtaNote \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build-course/UtaNote-1.1.0.xcarchive \
  -allowProvisioningUpdates archive
```

运行检查路由：

```bash
xcrun simctl launch booted com.rare.utanote --uta-route home --uta-demo-data
xcrun simctl launch booted com.rare.utanote --uta-route course --uta-demo-data
xcrun simctl launch booted com.rare.utanote --uta-route lesson --uta-demo-data
```

## TestFlight 导出

```bash
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
xcodebuild -exportArchive \
  -archivePath build-course/UtaNote-1.1.0.xcarchive \
  -exportPath build-course/TestFlight-1.1.0 \
  -exportOptionsPlist ExportOptions-TestFlight.plist \
  -allowProvisioningUpdates
```

也可以在 Xcode Organizer 中选择 `UtaNote-1.1.0.xcarchive`，点击 Distribute App → App Store Connect → Upload。

当前机器的本地归档已经成功；App Store Connect 导出需要账号先关联 provider，并获得创建 App Store 分发描述文件的权限。若看到 `No provider associated with App Store Connect user` 或 `does not have permission to create iOS App Store provisioning profiles`，请由 Account Holder 在 App Store Connect → Users and Access 中邀请当前 Apple ID，并授予 App Manager 或 Developer 及证书访问权限，然后在 Xcode → Settings → Accounts 刷新。

在账号权限处理前，可以导出仅供已登记设备安装的 Development IPA：

```bash
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
xcodebuild -exportArchive \
  -archivePath build-course/UtaNote-1.1.0.xcarchive \
  -exportPath build-course/Development-1.1.0 \
  -exportOptionsPlist ExportOptions-Development.plist \
  -allowProvisioningUpdates
```

## App Store Connect 填写建议

### Beta 描述

> UtaNote 现在加入了从零基础开始的日语开口课。第一月包含 24 节课，从自我介绍、购物和作息逐步走到问路与 90 秒综合会话。每课支持标准发音、真人录音反馈、GPT Live 陪练和间隔复习，也可以继续用原创歌曲或 Apple Music 歌曲巩固表达。

### 测试重点

1. 首次启动完成引导和课程计划设置；
2. 连续完成第 1–3 课，确认下一课解锁；
3. 在真机允许麦克风与语音识别，完成一次跟读评分；
4. 完成课程后进入“复习”，确认课程表达卡出现；
5. 复制 Live 指令并打开 ChatGPT，确认返回后课程状态保留；
6. 从旧版本覆盖安装，确认歌曲收藏、导入歌曲和复习记录仍在；
7. 深色模式和较大字体下检查首页、课程、测验与录音页。

### 隐私披露

- 不使用广告追踪；
- 原始跟读录音保存在临时目录，离开练习页时删除；
- 设备语音识别由 Apple Speech 框架处理；
- App 本地保存课程进度、复习状态、识别文本和评分；
- 点击“打开 ChatGPT”会离开 UtaNote，后续数据处理遵循用户的 ChatGPT 账户设置；
- Apple Music 功能需用户授权，UtaNote 保存用户主动导入歌曲的元数据和歌词打点。

## 发布前人工检查

- App Store Connect 已创建 `com.rare.utanote` 对应 App；
- Agreements、Tax、Banking 没有阻塞；
- App Privacy 与上面的真实数据流一致；
- TestFlight 合规问题选择“不使用非豁免加密”；
- 外部测试时填写 Beta App Review 联系方式；
- 版权说明明确：随包歌曲为原创，Apple Music 内容由用户自己的订阅播放。
