import SwiftData
import SwiftUI
import UIKit

struct CourseLessonView: View {
    let lesson: CourseLesson

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss

    @State private var stage = 0
    @State private var selectedQuizIndex: Int?
    @State private var quizPassed = false
    @State private var recording = RecordingController()
    @State private var feedback: PronunciationFeedback?
    @State private var isEvaluating = false
    @State private var liveCompleted = false
    @State private var didComplete = false
    @State private var copiedPrompt = false

    private let stageCount = 7

    var body: some View {
        ZStack {
            PaperBackground(tint: lesson.isWeeklyPerformance ? UtaColor.vermilion : UtaColor.indigo)
            VStack(spacing: 0) {
                progressHeader
                ScrollView(showsIndicators: false) {
                    stageContent
                        .frame(maxWidth: .infinity, minHeight: 500, alignment: .top)
                        .padding(.horizontal, 20)
                        .padding(.top, 18)
                        .padding(.bottom, 28)
                }
                if !didComplete { bottomBar }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if app.presentedCourseLesson != nil {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        app.presentedCourseLesson = nil
                    } label: {
                        Image(systemName: "xmark")
                    }
                }
            }
            ToolbarItem(placement: .principal) {
                Text(lesson.numberLabel)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(UtaColor.inkSoft)
            }
        }
        .onAppear {
            _ = CourseStore.start(lesson, in: context)
            app.audio.pause()
            app.musicPlayer.pause()
        }
        .onDisappear {
            recording.reset()
            app.tts.stop()
        }
    }

    private var progressHeader: some View {
        VStack(spacing: 8) {
            HStack {
                Text(stageTitle)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(UtaColor.inkFaint)
                Spacer()
                Text("\(min(stage + 1, stageCount))/\(stageCount)")
                    .font(.system(size: 11, weight: .medium, design: .rounded).monospacedDigit())
                    .foregroundStyle(UtaColor.inkFaint)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(UtaColor.hairline)
                    Capsule()
                        .fill(lesson.isWeeklyPerformance ? UtaColor.vermilion : UtaColor.indigo)
                        .frame(width: proxy.size.width * Double(stage + 1) / Double(stageCount))
                        .animation(.easeInOut(duration: 0.3), value: stage)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(UtaColor.paper.opacity(0.96))
    }

    private var stageTitle: String {
        ["今天会什么", "先听再说", "看懂规律", "确认理解", "真正开口", "Live 陪练", "带走一句"][min(stage, 6)]
    }

    @ViewBuilder
    private var stageContent: some View {
        switch stage {
        case 0: introStage
        case 1: phraseStage
        case 2: explanationStage
        case 3: quizStage
        case 4: speakingStage
        case 5: liveStage
        default: completionStage
        }
    }

    private var introStage: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 24)
            ZStack {
                Circle()
                    .fill((lesson.isWeeklyPerformance ? UtaColor.vermilion : UtaColor.indigo).opacity(0.11))
                    .frame(width: 96, height: 96)
                Image(systemName: lesson.isWeeklyPerformance ? "seal.fill" : "sparkles")
                    .font(.system(size: 36))
                    .foregroundStyle(lesson.isWeeklyPerformance ? UtaColor.vermilion : UtaColor.indigo)
            }
            VStack(spacing: 10) {
                Text(lesson.kicker)
                    .font(.lyric(12))
                    .foregroundStyle(UtaColor.inkFaint)
                    .kerning(2)
                Text(lesson.title)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(UtaColor.ink)
                Text(lesson.promise)
                    .font(.system(size: 15))
                    .foregroundStyle(UtaColor.inkSoft)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .padding(.horizontal, 12)
            }
            UtaCard {
                HStack(spacing: 13) {
                    Image(systemName: "target")
                        .font(.system(size: 20))
                        .foregroundStyle(UtaColor.vermilion)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("本课完成标准")
                            .font(.system(size: 11))
                            .foregroundStyle(UtaColor.inkFaint)
                        Text(lesson.canDo)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(UtaColor.ink)
                    }
                    Spacer()
                    Text("约 \(lesson.durationMinutes) 分钟")
                        .font(.system(size: 11))
                        .foregroundStyle(UtaColor.inkSoft)
                }
            }
        }
    }

    private var phraseStage: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionIntro("先用耳朵认识", subtitle: "点播放，先完整听，再慢速跟读。")
            ForEach(lesson.phrases) { phrase in
                UtaCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(phrase.text)
                            .font(.lyric(23, heavy: true))
                            .foregroundStyle(UtaColor.ink)
                        Text(phrase.reading)
                            .font(.lyric(12))
                            .foregroundStyle(UtaColor.indigo)
                        Text(phrase.translation)
                            .font(.system(size: 13.5))
                            .foregroundStyle(UtaColor.inkSoft)
                        HStack(spacing: 10) {
                            SpeakButton(
                                title: "听一遍", icon: "speaker.wave.2.fill",
                                active: app.tts.activeUtteranceKey == phrase.id
                            ) {
                                app.tts.toggle(phrase.text, key: phrase.id)
                            }
                            SpeakButton(
                                title: "慢速", icon: "tortoise.fill",
                                active: app.tts.activeUtteranceKey == phrase.id + "#slow"
                            ) {
                                app.tts.toggle(phrase.text, slow: true, key: phrase.id)
                            }
                        }
                    }
                }
            }
        }
    }

    private var explanationStage: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionIntro("只看懂一个规律", subtitle: "先能使用，再逐渐补完整知识。")
            UtaCard {
                VStack(alignment: .leading, spacing: 14) {
                    Label("本课规律", systemImage: "lightbulb.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(UtaColor.indigo)
                    Text(lesson.explanation)
                        .font(.system(size: 15))
                        .foregroundStyle(UtaColor.ink)
                        .lineSpacing(5)
                    Divider().overlay(UtaColor.hairline)
                    Text(lesson.primaryPhrase.note)
                        .font(.system(size: 12.5))
                        .foregroundStyle(UtaColor.inkSoft)
                        .lineSpacing(3)
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("今天顺手认识")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(UtaColor.inkSoft)
                FlowLayout(alignment: .leading, spacing: 9, rowSpacing: 9) {
                    ForEach(lesson.kana, id: \.self) { kana in
                        Text(kana)
                            .font(.lyric(20, heavy: true))
                            .foregroundStyle(UtaColor.ink)
                            .frame(minWidth: 42, minHeight: 42)
                            .background(
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(UtaColor.paperRaised))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .strokeBorder(UtaColor.hairline, lineWidth: 0.8))
                    }
                }
                Text("不用今天背完；它们会在后续词句里不断回来。")
                    .font(.system(size: 11))
                    .foregroundStyle(UtaColor.inkFaint)
            }
        }
    }

    private var quizStage: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionIntro("不用猜自己的感觉", subtitle: "答对这道题，确认你真的理解了。")
            Text(lesson.quiz.prompt)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(UtaColor.ink)
                .lineSpacing(4)
            VStack(spacing: 11) {
                ForEach(Array(lesson.quiz.choices.enumerated()), id: \.offset) { index, choice in
                    Button {
                        selectedQuizIndex = index
                        quizPassed = index == lesson.quiz.correctIndex
                        if quizPassed { Haptics.success() } else { Haptics.tap() }
                    } label: {
                        HStack(spacing: 12) {
                            Text(String(UnicodeScalar(65 + index)!))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(choiceColor(index))
                                .frame(width: 30, height: 30)
                                .background(Circle().fill(choiceColor(index).opacity(0.12)))
                            Text(choice)
                                .font(.system(size: 14.5, weight: .medium))
                                .foregroundStyle(UtaColor.ink)
                                .multilineTextAlignment(.leading)
                            Spacer()
                            if selectedQuizIndex == index {
                                Image(systemName: quizPassed ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .foregroundStyle(choiceColor(index))
                            }
                        }
                        .padding(14)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(UtaColor.paperRaised))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .strokeBorder(selectedQuizIndex == index ? choiceColor(index) : UtaColor.hairline, lineWidth: 1))
                    }
                    .buttonStyle(PressableStyle(scale: 0.985))
                }
            }
            if selectedQuizIndex != nil {
                UtaCard {
                    Text(quizPassed ? "答对了。\(lesson.quiz.explanation)" : "再看一次：\(lesson.quiz.explanation)")
                        .font(.system(size: 13.5))
                        .foregroundStyle(quizPassed ? UtaColor.matcha : UtaColor.vermilion)
                        .lineSpacing(3)
                }
            }
        }
    }

    private func choiceColor(_ index: Int) -> Color {
        guard selectedQuizIndex == index else { return UtaColor.indigo }
        return quizPassed ? UtaColor.matcha : UtaColor.vermilion
    }

    private var speakingStage: some View {
        VStack(spacing: 20) {
            sectionIntro("现在轮到你说", subtitle: "录音只用于本次设备端识别，不保存原始音频。")
                .frame(maxWidth: .infinity, alignment: .leading)
            VStack(spacing: 9) {
                Text(lesson.primaryPhrase.text)
                    .font(.lyric(25, heavy: true))
                    .foregroundStyle(UtaColor.ink)
                    .multilineTextAlignment(.center)
                Text(lesson.primaryPhrase.reading)
                    .font(.lyric(12))
                    .foregroundStyle(UtaColor.indigo)
                SpeakButton(
                    title: "先听标准发音", icon: "speaker.wave.2.fill",
                    active: app.tts.activeUtteranceKey == "course-practice-\(lesson.id)"
                ) {
                    app.tts.toggle(lesson.primaryPhrase.text, slow: true, key: "course-practice-\(lesson.id)")
                }
                .disabled(recording.phase == .recording)
            }
            if recording.phase == .recording {
                WaveformView(levels: recording.levelHistory)
                Text(String(format: "%.1f s", recording.elapsed))
                    .font(.timecode)
                    .foregroundStyle(UtaColor.inkSoft)
            }
            if recording.phase == .denied {
                UtaCard {
                    Text("需要麦克风权限才能评分。你仍可先完成课程，之后到 设置 → UtaNote 开启权限再练。")
                        .font(.system(size: 13))
                        .foregroundStyle(UtaColor.inkSoft)
                }
            }
            RecordButton(isRecording: recording.phase == .recording) {
                Task { await handleRecordTap() }
            }
            Text(recording.phase == .recording ? "再点一下结束并评分" : "点击开始跟读")
                .font(.system(size: 12))
                .foregroundStyle(UtaColor.inkFaint)
            if recording.phase == .recorded, feedback == nil, !isEvaluating {
                PillButton("评估刚才的录音", icon: "waveform.badge.magnifyingglass", prominent: true) {
                    Task { await evaluate() }
                }
            }
            if isEvaluating {
                HStack(spacing: 9) {
                    ProgressView()
                    Text("正在听你的发音…")
                        .font(.system(size: 13))
                        .foregroundStyle(UtaColor.inkSoft)
                }
            }
            if let feedback {
                FeedbackCard(feedback: feedback)
                PillButton("再录一次", icon: "arrow.counterclockwise") {
                    self.feedback = nil
                    recording.reset()
                }
            }
        }
    }

    private var liveStage: some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionIntro("和 GPT Live 说三轮", subtitle: "Live 是陪练老师，课程范围仍由 UtaNote 控制。")
            UtaCard {
                VStack(alignment: .leading, spacing: 13) {
                    Label("本次任务", systemImage: "bubble.left.and.bubble.right.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(UtaColor.indigo)
                    Text(lesson.liveMission)
                        .font(.system(size: 15))
                        .foregroundStyle(UtaColor.ink)
                        .lineSpacing(4)
                    Text("打开 ChatGPT 后进入语音 Live，将陪练指令粘贴到同一对话。")
                        .font(.system(size: 11.5))
                        .foregroundStyle(UtaColor.inkFaint)
                }
            }
            Button {
                UIPasteboard.general.string = lesson.livePrompt
                copiedPrompt = true
                Haptics.success()
            } label: {
                Label(copiedPrompt ? "已复制陪练指令" : "复制陪练指令", systemImage: copiedPrompt ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(UtaColor.indigo)
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(Capsule().fill(UtaColor.indigo.opacity(0.11)))
            }
            .buttonStyle(PressableStyle())
            Button {
                if !copiedPrompt { UIPasteboard.general.string = lesson.livePrompt }
                if let url = URL(string: "https://chatgpt.com/") { openURL(url) }
            } label: {
                Label("打开 ChatGPT", systemImage: "arrow.up.right.square")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Capsule().fill(UtaColor.vermilion))
            }
            .buttonStyle(PressableStyle())
            Button {
                liveCompleted.toggle()
                Haptics.tap()
            } label: {
                HStack(spacing: 11) {
                    Image(systemName: liveCompleted ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(liveCompleted ? UtaColor.matcha : UtaColor.inkFaint)
                    Text("我完成了至少三轮对话")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(UtaColor.ink)
                    Spacer()
                }
                .padding(15)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(UtaColor.paperRaised))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(UtaColor.hairline, lineWidth: 0.8))
            }
            .buttonStyle(PressableStyle(scale: 0.985))
            Text("没有安装或暂时不想使用 Live，也可以继续完成本课；课程会保留未完成标记。")
                .font(.system(size: 11))
                .foregroundStyle(UtaColor.inkFaint)
                .lineSpacing(3)
        }
    }

    private var completionStage: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 18)
            SealStamp(size: 76, character: didComplete ? "済" : "習")
            VStack(spacing: 9) {
                Text(didComplete ? "今天真的会了一句" : "把今天的能力收进口袋")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(UtaColor.ink)
                Text(lesson.primaryPhrase.text)
                    .font(.lyric(22, heavy: true))
                    .foregroundStyle(UtaColor.ink)
                    .multilineTextAlignment(.center)
                Text(lesson.primaryPhrase.translation)
                    .font(.system(size: 13.5))
                    .foregroundStyle(UtaColor.inkSoft)
            }
            UtaCard {
                VStack(alignment: .leading, spacing: 11) {
                    resultRow("理解测验", done: quizPassed)
                    resultRow("跟读评分", done: feedback != nil)
                    resultRow("Live 三轮", done: liveCompleted)
                    Divider().overlay(UtaColor.hairline)
                    Text("明天：\(lesson.tomorrowHook)")
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundStyle(UtaColor.indigo)
                }
            }
            if !didComplete {
                Button {
                    CourseStore.complete(
                        lesson, quizPassed: quizPassed,
                        liveCompleted: liveCompleted, in: context)
                    didComplete = true
                    Haptics.success()
                } label: {
                    Text("完成本课")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(Capsule().fill(UtaColor.vermilion))
                }
                .buttonStyle(PressableStyle())
            } else {
                VStack(spacing: 12) {
                    if let next = CourseCatalog.lessons.first(where: { $0.sequence == lesson.sequence + 1 }) {
                        NavigationLink(value: next) {
                            Label("查看下一课", systemImage: "arrow.right")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(Capsule().fill(UtaColor.indigo))
                        }
                        .buttonStyle(PressableStyle())
                    }
                    Button("返回课程地图") { dismiss() }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(UtaColor.inkSoft)
                }
            }
        }
    }

    private func resultRow(_ title: String, done: Bool) -> some View {
        HStack {
            Image(systemName: done ? "checkmark.circle.fill" : "circle.dashed")
                .foregroundStyle(done ? UtaColor.matcha : UtaColor.inkFaint)
            Text(title)
                .font(.system(size: 13.5))
                .foregroundStyle(UtaColor.ink)
            Spacer()
            Text(done ? "完成" : "稍后补做")
                .font(.system(size: 11))
                .foregroundStyle(UtaColor.inkFaint)
        }
    }

    private func sectionIntro(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(UtaColor.ink)
            Text(subtitle)
                .font(.system(size: 13))
                .foregroundStyle(UtaColor.inkSoft)
        }
    }

    private var bottomBar: some View {
        HStack(spacing: 12) {
            if stage > 0 {
                Button {
                    withAnimation(.easeInOut(duration: 0.22)) { stage -= 1 }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(UtaColor.ink)
                        .frame(width: 46, height: 46)
                        .background(Circle().fill(UtaColor.paperInset))
                }
                .buttonStyle(PressableStyle())
            }
            if stage < stageCount - 1 {
                Button {
                    app.tts.stop()
                    withAnimation(.easeInOut(duration: 0.22)) { stage += 1 }
                } label: {
                    Text(stage == 5 ? "查看本课结果" : "继续")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Capsule().fill(canContinue ? UtaColor.indigo : UtaColor.inkFaint))
                }
                .buttonStyle(PressableStyle())
                .disabled(!canContinue)
            } else {
                Spacer()
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .padding(.bottom, 10)
        .background(.ultraThinMaterial)
    }

    private var canContinue: Bool {
        if stage == 3 { return quizPassed }
        return stage < stageCount - 1
    }

    private func handleRecordTap() async {
        if recording.phase == .recording {
            recording.stopRecording()
            Haptics.tap()
            await evaluate()
        } else {
            app.tts.stop()
            feedback = nil
            await recording.start()
        }
    }

    private func evaluate() async {
        guard let url = recording.recordingURL else { return }
        isEvaluating = true
        let result = await app.evaluator.evaluate(recording: url, line: lesson.primaryPhrase.practiceLine)
        isEvaluating = false
        feedback = result
        CourseStore.record(feedback: result, lesson: lesson, in: context)
        if result.score >= 85 { Haptics.success() }
    }
}
