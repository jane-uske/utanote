import SwiftUI

/// Apple Music 导入歌的夜舞台：真封面浸染背景，歌词流/循环/学习/收藏与本地播放器同体验。
struct ImportedPlayerView: View {
    let song: Song

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var studyLine: LyricLine?
    @State private var stampedLineID: String?

    var body: some View {
        ZStack {
            backdrop
            VStack(spacing: 0) {
                header
                LyricFlowView(
                    song: song,
                    showTranslations: false,
                    currentLineIndex: app.musicPlayer.currentLineIndex,
                    studyLine: $studyLine,
                    stampedLineID: $stampedLineID)
                controls
            }
        }
        .environment(\.colorScheme, .dark)
        .sheet(item: $studyLine) { line in
            ImportedLineStudySheet(song: song, line: line)
        }
        .onChange(of: studyLine) { _, newValue in
            if newValue != nil { app.musicPlayer.pause() }
        }
        .onDisappear {
            if app.presentedImportedSong == nil { app.musicPlayer.stop() }
        }
    }

    // MARK: - 背景：真封面压暗浸染

    private var backdrop: some View {
        ZStack {
            PlayerBackdrop(song: song)
            if let urlString = song.artworkURL, let url = URL(string: urlString) {
                // scaledToFill 的溢出必须收在 overlay+clipped 里，否则会把整个页面撑出屏幕
                Rectangle()
                    .fill(.clear)
                    .overlay {
                        AsyncImage(url: url) { image in
                            image.resizable()
                                .scaledToFill()
                                .blur(radius: 70)
                                .opacity(0.45)
                        } placeholder: {
                            Color.clear
                        }
                    }
                    .overlay(UtaColor.stageInk.opacity(0.55))
                    .clipped()
                    .ignoresSafeArea()
            }
        }
    }

    // MARK: - 顶栏

    private var header: some View {
        HStack {
            Button {
                app.presentedImportedSong = nil
                app.musicPlayer.stop()
                dismiss()
            } label: {
                Image(systemName: "chevron.down")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.75))
                    .frame(width: 42, height: 42)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Spacer()
            VStack(spacing: 2) {
                Text(song.title)
                    .font(.lyric(17, heavy: true))
                    .foregroundStyle(.white.opacity(0.95))
                    .lineLimit(1)
                Text(song.artist)
                    .font(.system(size: 11.5))
                    .foregroundStyle(.white.opacity(0.55))
                    .kerning(1)
                    .lineLimit(1)
            }
            Spacer()
            Chip(text: "Apple Music", color: .white.opacity(0.6))
                .padding(.trailing, 6)
        }
        .padding(.horizontal, 12)
        .padding(.top, 6)
    }

    // MARK: - 控制区

    private var controls: some View {
        let player = app.musicPlayer
        return VStack(spacing: 12) {
            if let error = player.lastError {
                Text(error)
                    .font(.system(size: 11.5))
                    .foregroundStyle(.white.opacity(0.6))
            }
            ProgressStrip(
                duration: player.duration,
                current: player.currentTime,
                accent: song.accentColor
            ) { player.seek(to: $0) }
            HStack(spacing: 0) {
                Color.clear.frame(width: 44, height: 44)
                Spacer()
                ControlIcon(name: "backward.end.fill", size: 18) {
                    player.stepLine(-1)
                    Haptics.selection()
                }
                Spacer()
                playPauseButton
                Spacer()
                ControlIcon(name: "forward.end.fill", size: 18) {
                    player.stepLine(1)
                    Haptics.selection()
                }
                Spacer()
                loopButton
            }
        }
        .padding(.horizontal, 26)
        .padding(.bottom, 12)
    }

    private var playPauseButton: some View {
        Button {
            app.musicPlayer.togglePlayPause()
            Haptics.tap()
        } label: {
            ZStack {
                Circle()
                    .fill(.white.opacity(0.95))
                    .frame(width: 62, height: 62)
                    .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
                Image(systemName: app.musicPlayer.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(UtaColor.stageInk)
                    .contentTransition(.symbolEffect(.replace))
            }
        }
        .buttonStyle(PressableStyle(scale: 0.92))
    }

    private var loopButton: some View {
        let player = app.musicPlayer
        return Button {
            if let index = player.currentLineIndex {
                player.toggleLoop(lineID: song.lines[index].id)
                Haptics.selection()
            }
        } label: {
            Image(systemName: "repeat.1")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(player.loopingLineID != nil ? song.accentColor : .white.opacity(0.65))
                .frame(width: 44, height: 44)
                .background(Circle().fill(.white.opacity(player.loopingLineID != nil ? 0.12 : 0)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 导入歌的单句学习卡（注音 + 发音 + 跟读；AI 讲解留接口）

struct ImportedLineStudySheet: View {
    let song: Song
    let line: LyricLine

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var isSaved = false

    var body: some View {
        NavigationStack {
            ZStack {
                PaperBackground()
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 22) {
                        RubyText(tokens: line.tokens, surfaceSize: 24, alignment: .center)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 18)
                        Text("假名为设备端自动注音，偶有误读")
                            .font(.system(size: 10.5))
                            .foregroundStyle(UtaColor.inkFaint)
                        HStack(spacing: 10) {
                            SpeakButton(
                                title: "标准发音",
                                icon: "speaker.wave.2.fill",
                                active: app.tts.activeUtteranceKey == "im-" + line.id
                            ) {
                                app.tts.toggle(line.text, key: "im-" + line.id)
                            }
                            SpeakButton(
                                title: "慢速",
                                icon: "tortoise.fill",
                                active: app.tts.activeUtteranceKey == "im-" + line.id + "#slow"
                            ) {
                                app.tts.toggle(line.text, slow: true, key: "im-" + line.id)
                            }
                        }
                        UtaCard {
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: "sparkles")
                                    .font(.system(size: 14))
                                    .foregroundStyle(UtaColor.indigo)
                                Text("这句的翻译、词汇和语法讲解将接入 AI 服务——现在先把发音练起来。")
                                    .font(.system(size: 12.5))
                                    .foregroundStyle(UtaColor.inkSoft)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        HStack(spacing: 14) {
                            PillButton(isSaved ? "已在歌词本" : "盖章收藏", icon: "seal") {
                                isSaved = UserDataStore.toggleSaved(song: song, line: line, in: context)
                                if isSaved { Haptics.stamp() }
                            }
                            NavigationLink(value: "practice") {
                                HStack(spacing: 5) {
                                    Image(systemName: "mic.fill").font(.system(size: 13))
                                    Text("跟读练习").font(.system(size: 13.5, weight: .medium))
                                }
                                .padding(.horizontal, 14)
                                .frame(height: 36)
                                .background(Capsule().fill(UtaColor.vermilion))
                                .foregroundStyle(.white)
                            }
                            .buttonStyle(PressableStyle())
                        }
                        Color.clear.frame(height: 20)
                    }
                    .padding(.horizontal, 22)
                }
            }
            .navigationTitle("这一句")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("关闭") { dismiss() }
                }
            }
            .navigationDestination(for: String.self) { destination in
                if destination == "practice" {
                    PracticeView(song: song, line: line)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear {
            isSaved = UserDataStore.isSaved(songID: song.id, lineID: line.id, in: context)
            UserDataStore.markStudied(song: song, line: line, in: context)
        }
        .onDisappear { app.tts.stop() }
    }
}
