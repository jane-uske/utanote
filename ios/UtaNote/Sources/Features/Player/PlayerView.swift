import SwiftUI

/// 沉浸式歌词播放器——「夜舞台」。永远深色，被歌曲的封面色浸染。
struct PlayerView: View {
    let song: Song

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var studyLine: LyricLine?
    @State private var showTranslations = false
    @State private var showHint = true
    @State private var stampedLineID: String?

    var body: some View {
        ZStack {
            PlayerBackdrop(song: song)
            VStack(spacing: 0) {
                header
                LyricFlowView(
                    song: song,
                    showTranslations: showTranslations,
                    currentLineIndex: app.audio.currentLineIndex,
                    studyLine: $studyLine,
                    stampedLineID: $stampedLineID)
                controls
            }
        }
        .environment(\.colorScheme, .dark)
        .sheet(item: $studyLine) { line in
            LineStudyView(song: song, line: line)
        }
        .onChange(of: studyLine) { _, newValue in
            if newValue != nil { app.audio.pause() }
        }
        .task {
            if let pending = app.pendingStudyLineID, let line = song.line(withID: pending) {
                app.pendingStudyLineID = nil
                try? await Task.sleep(for: .milliseconds(450))
                studyLine = line
            }
            try? await Task.sleep(for: .seconds(6))
            withAnimation(.easeOut(duration: 0.8)) { showHint = false }
        }
    }

    // MARK: - 顶栏

    private var header: some View {
        HStack {
            Button {
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
                Text(song.artist)
                    .font(.system(size: 11.5))
                    .foregroundStyle(.white.opacity(0.55))
                    .kerning(1)
            }

            Spacer()

            Menu {
                Toggle("显示中文对照", isOn: $showTranslations)
                Section {
                    Text("\(song.titleTranslation) · \(song.level)")
                    Text(song.summary)
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.75))
                    .frame(width: 42, height: 42)
                    .contentShape(Rectangle())
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 6)
    }

    // MARK: - 控制区

    private var controls: some View {
        @Bindable var audio = app.audio
        return VStack(spacing: 12) {
            if showHint {
                Text("轻点歌词，读懂这一句 · 长按收藏")
                    .font(.system(size: 11.5))
                    .foregroundStyle(.white.opacity(0.4))
                    .transition(.opacity)
            }
            if !audio.hasAudio {
                Text("演示音频未打包——仍可逐句学习")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.35))
            }
            ProgressStrip(
                duration: audio.duration,
                current: audio.currentTime,
                accent: song.accentColor
            ) { target in
                audio.seek(to: target)
            }
            HStack(spacing: 0) {
                RateMenu(rate: $audio.playbackRate)
                Spacer()
                ControlIcon(name: "backward.end.fill", size: 18) {
                    audio.stepLine(-1)
                    Haptics.selection()
                }
                Spacer()
                playPauseButton
                Spacer()
                ControlIcon(name: "forward.end.fill", size: 18) {
                    audio.stepLine(1)
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
            app.audio.togglePlayPause()
            Haptics.tap()
        } label: {
            ZStack {
                Circle()
                    .fill(.white.opacity(0.95))
                    .frame(width: 62, height: 62)
                    .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
                Image(systemName: app.audio.isPlaying ? "pause.fill" : "play.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(UtaColor.stageInk)
                    .contentTransition(.symbolEffect(.replace))
            }
        }
        .buttonStyle(PressableStyle(scale: 0.92))
        .disabled(!app.audio.hasAudio)
        .opacity(app.audio.hasAudio ? 1 : 0.4)
    }

    private var loopButton: some View {
        Button {
            if let index = app.audio.currentLineIndex {
                app.audio.toggleLoop(lineID: song.lines[index].id)
                Haptics.selection()
            }
        } label: {
            Image(systemName: "repeat.1")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(app.audio.loopingLineID != nil ? song.accentColor : .white.opacity(0.65))
                .frame(width: 44, height: 44)
                .background(Circle().fill(.white.opacity(app.audio.loopingLineID != nil ? 0.12 : 0)))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 小件

struct ControlIcon: View {
    let name: String
    var size: CGFloat = 18
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: name)
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(.white.opacity(0.85))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(PressableStyle(scale: 0.88))
    }
}

private struct RateMenu: View {
    @Binding var rate: Double

    var body: some View {
        Menu {
            ForEach([0.6, 0.8, 1.0], id: \.self) { value in
                Button {
                    rate = value
                } label: {
                    HStack {
                        Text(label(for: value))
                        if rate == value { Image(systemName: "checkmark") }
                    }
                }
            }
        } label: {
            Text(label(for: rate))
                .font(.system(size: 12.5, weight: .semibold, design: .rounded))
                .foregroundStyle(.white.opacity(rate == 1.0 ? 0.65 : 0.95))
                .frame(width: 44, height: 30)
                .background(Capsule().fill(.white.opacity(rate == 1.0 ? 0.10 : 0.2)))
        }
    }

    private func label(for value: Double) -> String {
        value == 1.0 ? "1.0×" : String(format: "%.1f×", value)
    }
}

struct ProgressStrip: View {
    let duration: Double
    let current: Double
    let accent: Color
    let onSeek: (Double) -> Void

    @State private var dragProgress: Double?

    var body: some View {
        VStack(spacing: 5) {
            GeometryReader { geo in
                let progress = dragProgress ?? (duration > 0 ? min(1, current / duration) : 0)
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.16)).frame(height: 3)
                    Capsule().fill(accent).frame(width: max(0, geo.size.width * progress), height: 3)
                    Circle()
                        .fill(.white)
                        .frame(width: dragProgress != nil ? 13 : 9, height: dragProgress != nil ? 13 : 9)
                        .offset(x: geo.size.width * progress - 5)
                        .animation(.spring(response: 0.25, dampingFraction: 0.8), value: dragProgress != nil)
                }
                .frame(maxHeight: .infinity)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            dragProgress = min(1, max(0, value.location.x / max(1, geo.size.width)))
                        }
                        .onEnded { value in
                            let progress = min(1, max(0, value.location.x / max(1, geo.size.width)))
                            onSeek(progress * duration)
                            dragProgress = nil
                        })
            }
            .frame(height: 24)
            HStack {
                Text(timecode(dragProgress.map { $0 * duration } ?? current))
                    .font(.timecode)
                    .foregroundStyle(.white.opacity(0.5))
                Spacer()
                Text(timecode(duration))
                    .font(.timecode)
                    .foregroundStyle(.white.opacity(0.5))
            }
        }
    }
}

/// 歌曲专属的夜色背景：封面双色被压暗，落到舞台墨色，覆一层和纸颗粒。
struct PlayerBackdrop: View {
    let song: Song

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(hex: song.coverStyle.colors[0]).darkened(0.5),
                    Color(hex: song.coverStyle.colors.count > 1 ? song.coverStyle.colors[1] : song.coverStyle.colors[0]).darkened(0.72),
                    UtaColor.stageInk,
                ],
                startPoint: .top,
                endPoint: .bottom)
            Text(song.coverStyle.glyph)
                .font(.lyric(340, heavy: true))
                .foregroundStyle(.white.opacity(0.045))
                .rotationEffect(.degrees(-6))
                .offset(x: 110, y: -150)
                .blur(radius: 1.5)
            GrainOverlay(opacity: 0.05)
        }
        .ignoresSafeArea()
    }
}
