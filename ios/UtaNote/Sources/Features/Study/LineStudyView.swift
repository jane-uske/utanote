import SwiftData
import SwiftUI

/// 单句学习页：假名 → 翻译 → 词汇 → 语法 → 情绪与语感 → 跟读。
struct LineStudyView: View {
    let song: Song
    let line: LyricLine

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var isSaved = false
    @State private var inReview = false
    @State private var path = NavigationPath()
    @State private var detent: PresentationDetent = .medium

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                UtaColor.paper.ignoresSafeArea()
                GrainOverlay(opacity: 0.03)
                ScrollView(showsIndicators: false) {
                    content
                }
                .safeAreaInset(edge: .bottom) { actionBar }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { destination in
                if destination == "practice" {
                    PracticeView(song: song, line: line)
                }
            }
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .presentationBackground(UtaColor.paper)
        .task {
            isSaved = UserDataStore.isSaved(songID: song.id, lineID: line.id, in: context)
            inReview = UserDataStore.reviewCard(songID: song.id, lineID: line.id, in: context) != nil
            UserDataStore.markStudied(song: song, line: line, in: context)
            if app.pendingPracticeImmediately {
                app.pendingPracticeImmediately = false
                detent = .large
                path.append("practice")
            }
        }
        .onDisappear { app.tts.stop() }
    }

    // MARK: - 内容

    private var content: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(spacing: 14) {
                HStack {
                    EmotionBadge(emotion: line.emotion)
                    Spacer()
                    Text("\(song.title) · \(song.level)")
                        .font(.system(size: 11.5))
                        .foregroundStyle(UtaColor.inkFaint)
                }
                RubyText(tokens: line.tokens, surfaceSize: 29, alignment: .center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 2)
                Text(line.translation)
                    .font(.system(size: 15))
                    .foregroundStyle(UtaColor.inkSoft)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                HStack(spacing: 10) {
                    SpeakButton(
                        title: "标准发音",
                        icon: "speaker.wave.2.fill",
                        active: app.tts.activeUtteranceKey == line.id
                    ) {
                        app.tts.toggle(line.text, key: line.id)
                    }
                    SpeakButton(
                        title: "慢速",
                        icon: "tortoise.fill",
                        active: app.tts.activeUtteranceKey == line.id + "#slow"
                    ) {
                        app.tts.toggle(line.text, slow: true, key: line.id)
                    }
                    PillButton("从这句播放", icon: "play.fill") {
                        app.audio.seek(to: line.start)
                        app.audio.play()
                        dismiss()
                    }
                }
            }
            .padding(.top, 20)

            if !line.words.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(title: "词汇", kicker: "ことば")
                    ForEach(line.words) { word in
                        WordCard(word: word)
                    }
                }
            }

            if !line.grammar.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(title: "语法", kicker: "ぶんぽう")
                    ForEach(line.grammar) { grammar in
                        GrammarCard(grammar: grammar)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "这句在唱什么", kicker: "きもち")
                UtaCard {
                    Text(line.emotion.note)
                        .font(.system(size: 13.5))
                        .foregroundStyle(UtaColor.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            if let culture = line.culture {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(title: "文化与语感", kicker: "ことばのおく")
                    UtaCard {
                        Text(culture)
                            .font(.system(size: 13.5))
                            .foregroundStyle(UtaColor.ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }

            if let tip = line.singingTip {
                UtaCard {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "music.mic")
                            .font(.system(size: 15))
                            .foregroundStyle(UtaColor.vermilion)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("唱出来")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(UtaColor.inkSoft)
                            Text(tip)
                                .font(.system(size: 13.5))
                                .foregroundStyle(UtaColor.ink)
                        }
                        Spacer(minLength: 0)
                    }
                }
            }

            Color.clear.frame(height: 8)
        }
        .padding(.horizontal, 20)
    }

    // MARK: - 底部操作

    private var actionBar: some View {
        HStack(spacing: 14) {
            Button {
                toggleSave()
            } label: {
                VStack(spacing: 3) {
                    StampToggle(isOn: isSaved, size: 26)
                    Text(isSaved ? "已收藏" : "收藏")
                        .font(.system(size: 10.5))
                        .foregroundStyle(UtaColor.inkSoft)
                }
                .frame(width: 54)
            }
            .buttonStyle(.plain)

            Button {
                toggleReview()
            } label: {
                VStack(spacing: 3) {
                    Image(systemName: inReview ? "clock.badge.checkmark.fill" : "clock.arrow.circlepath")
                        .font(.system(size: 19))
                        .foregroundStyle(inReview ? UtaColor.indigo : UtaColor.inkSoft)
                        .frame(height: 26)
                    Text(inReview ? "已加入" : "复习")
                        .font(.system(size: 10.5))
                        .foregroundStyle(UtaColor.inkSoft)
                }
                .frame(width: 54)
            }
            .buttonStyle(.plain)

            Button {
                detent = .large
                path.append("practice")
            } label: {
                Label("跟读练习", systemImage: "mic.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(Capsule().fill(UtaColor.vermilion))
            }
            .buttonStyle(PressableStyle())
        }
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(UtaColor.paper.opacity(0.97))
        .overlay(alignment: .top) {
            UtaColor.hairline.frame(height: 0.5)
        }
    }

    private func toggleSave() {
        isSaved = UserDataStore.toggleSaved(song: song, line: line, in: context)
        if isSaved {
            Haptics.stamp()
            inReview = true
        } else {
            Haptics.tap()
        }
    }

    private func toggleReview() {
        if inReview {
            UserDataStore.removeReviewCard(songID: song.id, lineID: line.id, in: context)
            inReview = false
            Haptics.tap()
        } else {
            UserDataStore.ensureReviewCard(songID: song.id, lineID: line.id, source: .manual, in: context)
            inReview = true
            Haptics.success()
        }
    }
}

// MARK: - 词汇卡 / 语法卡

struct WordCard: View {
    let word: WordEntry
    @Environment(AppModel.self) private var app

    var body: some View {
        UtaCard(padding: 13) {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        Text(word.surface)
                            .font(.lyric(18, heavy: true))
                            .foregroundStyle(UtaColor.ink)
                        Text(word.reading)
                            .font(.system(size: 12))
                            .foregroundStyle(UtaColor.inkSoft)
                        Chip(text: word.level, color: UtaColor.indigo, filled: true)
                    }
                    Text(word.meaning)
                        .font(.system(size: 13))
                        .foregroundStyle(UtaColor.ink)
                    if let note = word.note {
                        Text(note)
                            .font(.system(size: 12))
                            .foregroundStyle(UtaColor.inkFaint)
                    }
                }
                Spacer(minLength: 0)
                Button {
                    app.tts.toggle(word.surface, key: word.id)
                } label: {
                    Image(systemName: app.tts.activeUtteranceKey == word.id ? "waveform" : "speaker.wave.1")
                        .font(.system(size: 14))
                        .foregroundStyle(UtaColor.indigo)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(UtaColor.indigo.opacity(0.10)))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct GrammarCard: View {
    let grammar: GrammarPoint
    @Environment(AppModel.self) private var app

    var body: some View {
        UtaCard(padding: 13) {
            VStack(alignment: .leading, spacing: 9) {
                Text(grammar.pattern)
                    .font(.lyric(16, heavy: true))
                    .foregroundStyle(UtaColor.indigo)
                Text(grammar.explanation)
                    .font(.system(size: 13))
                    .foregroundStyle(UtaColor.ink)
                Rectangle()
                    .fill(UtaColor.hairline)
                    .frame(height: 0.6)
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(grammar.example)
                            .font(.lyric(14))
                            .foregroundStyle(UtaColor.ink)
                        Text(grammar.exampleTranslation)
                            .font(.system(size: 12))
                            .foregroundStyle(UtaColor.inkSoft)
                    }
                    Spacer(minLength: 0)
                    Button {
                        app.tts.toggle(grammar.example, key: grammar.id)
                    } label: {
                        Image(systemName: app.tts.activeUtteranceKey == grammar.id ? "waveform" : "speaker.wave.1")
                            .font(.system(size: 13))
                            .foregroundStyle(UtaColor.indigo)
                            .frame(width: 30, height: 30)
                            .background(Circle().fill(UtaColor.indigo.opacity(0.10)))
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
