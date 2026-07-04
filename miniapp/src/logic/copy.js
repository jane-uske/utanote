// Centralized user-visible copywriting, with a review-safe variant.
//
// REVIEW_SAFE_MODE = true  → 审核友好版：界面上不出现 AI/AIGC/DeepSeek/
//   VOICEVOX/TTS/大模型/智能/生成/合成/秒速/Beta 等表述，产品定位统一为
//   「日语歌词学习工具」（歌词拆解 / 发音跟读 / 语法讲解 / 生词卡片）。
// REVIEW_SAFE_MODE = false → 正式版文案，恢复 AI/引擎等表述。
//
// 只影响文案与入口显隐，不改任何业务逻辑。新增用户可见文案时，凡是带
// 技术/生成式表述的，都放进这里而不是写死在组件里。
export const REVIEW_SAFE_MODE = true

// ── 正式版（完整表述） ────────────────────────────────────────────
const FULL = {
  // 首页
  homeFeatures: [
    { icon: '🤖', title: 'AI 秒速拆解', desc: '粘贴歌词自动拆成逐句学习卡片' },
    { icon: '🔊', title: '合成语音跟读', desc: 'AI 发音朗读，逐句跟读更轻松' },
    { icon: '🈶', title: '逐词语法拆解', desc: '主语/助词/谓语高亮，语感看得见' },
    { icon: '📚', title: '生词自动入库', desc: '点词收藏，掌握度进度全追踪' },
  ],
  songTitlePlaceholder: '输入歌曲名称（可选，留空自动取名）',
  lyricsNotice: '请仅上传你有权使用或用于个人学习的歌词内容，不要上传、分享侵权内容。',
  startButton: '开始拆解 ✨',

  // 解析流程（loading 遮罩 + 阶段提示）
  parseOverlayDefault: 'AI 正在解析歌词…',
  parseOverlayHintEarly: '分批并发请求 AI 中，通常 10~15 秒完成',
  parseOverlayHintMid: '正在等待 AI 返回结构化解析结果…',
  parseStageDone: '解析完成，正在生成卡片…',
  parseNoticeLocal: '未配置 AI 解析，已生成本地分词草稿（读音/释义为占位）。在云函数配置密钥后可自动生成完整内容。',
  // null → 直接展示服务端返回的 warning 原文
  parsePartialWarning: null,

  // 朗读（loading 标签 + toast）
  ttsLoadingLabel: '生成中',
  slowChipIdle: '慢速跟读',
  ttsQuotaUsedUp: '今日可生成的学习音频额度已用完，已生成的内容仍可继续播放。',
  ttsGlobalBusy: '今日语音生成较多，请稍后再试，已生成的内容仍可继续播放。',
  ttsBusy: '语音生成繁忙，请稍后再试',
  ttsContentRisk: '朗读文本暂不支持生成语音，请修改后重试',

  // 学习提示卡（逐句讲解）
  assistantTitle: 'AI 学习助手',
  assistantBadge: '唱法 Beta',
  assistantChipLoading: '生成中…',
  assistantPreviewChips: ['这句的语气是什么？', '有没有更地道的说法？'],
  assistantFooter: 'AI 生成 · 仅供参考',
  coachQuotaUsedUp: '今日 AI 讲解额度已用完，已生成的讲解仍可继续查看。',
  coachBusy: '今日 AI 讲解生成较多，请稍后再试。',
  coachTooLong: '这句歌词太长了，暂不支持 AI 讲解。',
  coachContentRisk: '这句内容暂不支持 AI 讲解。',
  coachNotConfigured: 'AI 讲解服务未配置。',
  coachFailed: 'AI 讲解生成失败，请稍后再试。',

  // 关于页
  aboutIntro: '把一首日语歌拆成可学会的每一句。通过 AI 解析歌词，为每句生成注音、翻译、语法讲解和词汇卡片，让你在喜欢的音乐中自然习得日语。',
  aboutPrivacy: '歌词解析会将文本发送至云函数，并在配置 AI 时由 DeepSeek 生成学习解析；朗读会将选中的句子或单词发送至云函数和 TTS 服务生成合成音频，音频会缓存在微信云存储以便重复播放。收藏、学习进度和本地音频缓存保存在本设备；云端仅使用 OpenID 做额度统计和音频归属。',
  aboutInfoRows: [
    { label: '开发者', value: 'rare' },
    { label: 'TTS 引擎', value: 'VOICEVOX' },
    { label: 'AI 引擎', value: 'DeepSeek' },
  ],
  futurePlans: [
    { icon: '🎤', text: 'AI 评分带唱 & 教唱模式' },
    { icon: '🎯', text: '每日学习目标与打卡' },
    { icon: '📊', text: '学习数据统计与进度追踪' },
    { icon: '🃏', text: '间隔重复记忆曲线复习' },
    { icon: '👥', text: '分享成就卡片给好友' },
  ],
}

// ── 审核友好版（只覆盖有差异的键） ────────────────────────────────
const REVIEW = {
  homeFeatures: [
    { icon: '🎼', title: '歌词逐句拆解', desc: '粘贴歌词，整理成逐句学习卡片' },
    { icon: '🔊', title: '发音朗读跟读', desc: '标准朗读示范，逐句跟读更轻松' },
    { icon: '🈶', title: '逐词语法拆解', desc: '助词、谓语、表达重点清晰标注' },
    { icon: '📚', title: '生词加入词库', desc: '点词收藏，掌握度进度全追踪' },
  ],
  songTitlePlaceholder: '输入歌曲名称（可选）',
  lyricsNotice: '请仅粘贴你有权使用、或用于个人学习的歌词内容。',
  startButton: '开始学习 ✨',

  parseOverlayDefault: '正在整理歌词…',
  parseOverlayHintEarly: '正在整理学习卡片，通常 10~15 秒完成',
  parseOverlayHintMid: '正在整理注音、翻译与讲解…',
  parseStageDone: '整理完成，正在创建学习卡片…',
  parseNoticeLocal: '本次为基础整理（读音/释义为占位），可稍后重新导入补全。',
  parsePartialWarning: '部分句子未能完整整理，已提供基础版内容，可稍后重新导入补全。',

  ttsLoadingLabel: '加载中',
  ttsQuotaUsedUp: '今日朗读次数已用完，已有的朗读仍可继续播放。',
  ttsGlobalBusy: '朗读服务使用较多，请稍后再试，已有的朗读仍可继续播放。',
  ttsBusy: '朗读服务繁忙，请稍后再试',
  ttsContentRisk: '该内容暂不支持朗读，请修改后重试',

  assistantTitle: '学习提示',
  assistantBadge: '发音练习',
  assistantChipLoading: '加载中…',
  assistantPreviewChips: ['查看语气说明', '查看自然表达'],
  assistantFooter: '讲解内容 · 仅供参考',
  coachQuotaUsedUp: '今日讲解次数已用完，已有的讲解仍可继续查看。',
  coachBusy: '讲解服务使用较多，请稍后再试。',
  coachTooLong: '这句歌词太长了，暂不支持讲解。',
  coachContentRisk: '这句内容暂不支持讲解。',
  coachNotConfigured: '讲解功能暂未开放。',
  coachFailed: '讲解加载失败，请稍后再试。',

  aboutIntro: '把一首日语歌拆成可学会的每一句。UtaNote 会帮助你整理注音、翻译、语法讲解和词汇卡片，让你在喜欢的音乐中自然学习日语。',
  aboutPrivacy: '歌词整理和朗读功能需要通过云端服务处理必要文本，仅用于为你准备当前学习内容、朗读音频和学习记录，不会公开展示你的歌词内容。朗读音频可能会缓存至云存储，以便重复播放。收藏、学习进度和本地音频缓存会保存在你的设备或云端账号下，用于同步学习状态。',
  aboutInfoRows: [
    { label: '开发者', value: 'rare' },
    { label: '朗读方式', value: '标准朗读示范' },
    { label: '整理方式', value: '学习内容整理' },
  ],
  futurePlans: [
    { icon: '🎤', text: '跟读评分与练习模式' },
    { icon: '🎯', text: '每日学习目标与打卡' },
    { icon: '📊', text: '学习数据统计与进度追踪' },
    { icon: '🃏', text: '间隔重复记忆曲线复习' },
    { icon: '👥', text: '分享成就卡片给好友' },
  ],
}

export const COPY = REVIEW_SAFE_MODE ? { ...FULL, ...REVIEW } : FULL
