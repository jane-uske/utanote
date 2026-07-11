import SwiftUI

/// 跟读练习：听 → 录 → 回放 → 结构化 AI 反馈。
struct PracticeView: View {
    let song: Song
    let line: LyricLine

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @State private var recording = RecordingController()
    @State private var feedback: PronunciationFeedback?
    @State private var isEvaluating = false

    var body: some View {
        ZStack {
            UtaColor.paper.ignoresSafeArea()
            GrainOverlay(opacity: 0.03)
            ScrollView(showsIndicators: false) {
                VStack(spacing: 26) {
                    targetSection
                    recordZone
                    if isEvaluating {
                        evaluatingIndicator
                    }
                    if let feedback {
                        FeedbackCard(feedback: feedback)
                        HStack(spacing: 14) {
                            PillButton("回放我的", icon: "play.circle") { recording.playBack() }
                            PillButton("再来一次", icon: "arrow.counterclockwise", prominent: true) { retry() }
                        }
                    }
                    Color.clear.frame(height: 30)
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
            }
        }
        .navigationTitle("跟读练习")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .onAppear { app.audio.pause() }
        .onDisappear {
            recording.reset()
            app.tts.stop()
        }
    }

    // MARK: - 目标句

    private var targetSection: some View {
        VStack(spacing: 12) {
            RubyText(tokens: line.tokens, surfaceSize: 25, alignment: .center)
                .frame(maxWidth: .infinity)
            Text(line.translation)
                .font(.system(size: 13.5))
                .foregroundStyle(UtaColor.inkSoft)
            HStack(spacing: 10) {
                SpeakButton(
                    title: "听原句",
                    icon: "speaker.wave.2.fill",
                    active: app.tts.activeUtteranceKey == "practice-" + line.id
                ) {
                    app.tts.toggle(line.text, key: "practice-" + line.id)
                }
                SpeakButton(
                    title: "慢速",
                    icon: "tortoise.fill",
                    active: app.tts.activeUtteranceKey == "practice-" + line.id + "#slow"
                ) {
                    app.tts.toggle(line.text, slow: true, key: "practice-" + line.id)
                }
            }
            // 录音中 TTS 外放会被录进跟读音频污染评分
            .disabled(recording.phase == .recording)
            .opacity(recording.phase == .recording ? 0.35 : 1)
            if let tip = line.singingTip {
                Text(tip)
                    .font(.system(size: 11.5))
                    .foregroundStyle(UtaColor.inkFaint)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - 录音区

    private var recordZone: some View {
        VStack(spacing: 14) {
            if recording.phase == .recording {
                WaveformView(levels: recording.levelHistory)
                Text(String(format: "%.1f s", recording.elapsed))
                    .font(.timecode)
                    .foregroundStyle(UtaColor.inkSoft)
            }
            if recording.phase == .denied {
                UtaCard {
                    Text("需要麦克风权限才能跟读。请到 设置 → UtaNote 开启。")
                        .font(.system(size: 13))
                        .foregroundStyle(UtaColor.ink)
                }
            }
            RecordButton(isRecording: recording.phase == .recording) {
                Task { await handleRecordTap() }
            }
            Text(recordLabel)
                .font(.system(size: 12))
                .foregroundStyle(UtaColor.inkFaint)
        }
    }

    private var recordLabel: String {
        switch recording.phase {
        case .recording: "再点一下结束"
        case .recorded, .playingBack: "点击重新跟读"
        default: feedback == nil ? "点击开始跟读这一句" : "点击重新跟读"
        }
    }

    private var evaluatingIndicator: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text("正在听你的发音…")
                .font(.system(size: 13))
                .foregroundStyle(UtaColor.inkSoft)
        }
        .padding(.vertical, 4)
    }

    // MARK: - 动作

    private func handleRecordTap() async {
        switch recording.phase {
        case .recording:
            recording.stopRecording()
            Haptics.tap()
            await evaluate()
        default:
            app.tts.stop()
            feedback = nil
            Haptics.tap()
            await recording.start()
        }
    }

    private func evaluate() async {
        guard let url = recording.recordingURL else { return }
        isEvaluating = true
        let result = await app.evaluator.evaluate(recording: url, line: line)
        isEvaluating = false
        feedback = result
        UserDataStore.recordPractice(song: song, line: line, feedback: result, in: context)
        if result.score >= 85 {
            Haptics.success()
        } else {
            Haptics.tap()
        }
    }

    private func retry() {
        feedback = nil
        recording.reset()
    }
}

// MARK: - 录音按钮

struct RecordButton: View {
    let isRecording: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .strokeBorder(UtaColor.vermilion.opacity(0.35), lineWidth: 2)
                    .frame(width: 84, height: 84)
                if isRecording {
                    PulsingRing()
                }
                RoundedRectangle(cornerRadius: isRecording ? 8 : 34, style: .continuous)
                    .fill(UtaColor.vermilion)
                    .frame(width: isRecording ? 34 : 68, height: isRecording ? 34 : 68)
                    .animation(.spring(response: 0.35, dampingFraction: 0.7), value: isRecording)
                if !isRecording {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(.white)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.93))
    }
}

private struct PulsingRing: View {
    @State private var expanded = false

    var body: some View {
        Circle()
            .stroke(UtaColor.vermilion.opacity(0.4), lineWidth: 2)
            .frame(width: 84, height: 84)
            .scaleEffect(expanded ? 1.25 : 1)
            .opacity(expanded ? 0 : 0.8)
            .onAppear {
                withAnimation(.easeOut(duration: 1.2).repeatForever(autoreverses: false)) {
                    expanded = true
                }
            }
    }
}

// MARK: - 反馈卡

struct FeedbackCard: View {
    let feedback: PronunciationFeedback

    var body: some View {
        UtaCard {
            VStack(spacing: 16) {
                HStack(spacing: 18) {
                    ScoreRing(score: feedback.score, size: 96)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(feedback.verdict.label)
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(UtaColor.ink)
                        if let recognized = feedback.recognizedText {
                            Text("听到你说：\(recognized)")
                                .font(.system(size: 12))
                                .foregroundStyle(UtaColor.inkSoft)
                                .lineLimit(2)
                        }
                        if feedback.isSimulated {
                            Text("演示反馈 · 设备语音识别不可用")
                                .font(.system(size: 10.5))
                                .foregroundStyle(UtaColor.inkFaint)
                        }
                    }
                    Spacer(minLength: 0)
                }
                FlowLayout(alignment: .leading, spacing: 6, rowSpacing: 6) {
                    ForEach(feedback.tokenResults) { result in
                        Text(result.surface)
                            .font(.lyric(15, heavy: !result.matched))
                            .foregroundStyle(result.matched ? UtaColor.ink : UtaColor.vermilion)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(result.matched ? UtaColor.paperInset : UtaColor.vermilion.opacity(0.12)))
                    }
                }
                if !feedback.tips.isEmpty {
                    VStack(alignment: .leading, spacing: 7) {
                        ForEach(feedback.tips, id: \.self) { tip in
                            HStack(alignment: .top, spacing: 7) {
                                Text("・")
                                    .foregroundStyle(UtaColor.vermilion)
                                Text(tip)
                                    .font(.system(size: 12.5))
                                    .foregroundStyle(UtaColor.inkSoft)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                if feedback.score < 70 {
                    Text("这句已自动加入复习队列")
                        .font(.system(size: 11))
                        .foregroundStyle(UtaColor.inkFaint)
                }
            }
        }
    }
}
