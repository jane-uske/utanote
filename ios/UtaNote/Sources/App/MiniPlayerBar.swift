import SwiftUI

/// 悬浮在标签栏上方的迷你播放条：旋转唱片 + 当前句 + 播放控制。
struct MiniPlayerBar: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        if let song = app.audio.song {
            Button {
                app.isPlayerPresented = true
            } label: {
                HStack(spacing: 10) {
                    SpinningCover(style: song.coverStyle, isSpinning: app.audio.isPlaying)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(song.title)
                            .font(.lyric(14, heavy: true))
                            .foregroundStyle(UtaColor.ink)
                            .lineLimit(1)
                        Text(currentLineText ?? song.artist)
                            .font(.system(size: 11))
                            .foregroundStyle(UtaColor.inkSoft)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Button {
                        app.audio.togglePlayPause()
                    } label: {
                        Image(systemName: app.audio.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(UtaColor.ink)
                            .frame(width: 38, height: 38)
                            .contentShape(Circle())
                            .contentTransition(.symbolEffect(.replace))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(UtaColor.paperRaised)
                        .shadow(color: .black.opacity(0.12), radius: 14, y: 4))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(UtaColor.hairline, lineWidth: 0.8))
            }
            .buttonStyle(PressableStyle(scale: 0.98))
        }
    }

    private var currentLineText: String? {
        guard let song = app.audio.song,
              let index = app.audio.currentLineIndex,
              song.lines.indices.contains(index) else { return nil }
        return song.lines[index].text
    }
}

/// 播放时旋转的小唱片。
/// 旋转用 repeatForever 动画交给渲染服务器——不要用 TimelineView 逐帧重建视图，
/// 那会让主线程每 33ms 重新光栅化整个封面（渐变+圆环+明朝体字形），滚动会掉帧。
struct SpinningCover: View {
    let style: CoverStyle
    let isSpinning: Bool

    @State private var spinning = false

    var body: some View {
        CoverArtView(style: style, cornerRadius: 19)
            .frame(width: 38, height: 38)
            .clipShape(Circle())
            .rotationEffect(.degrees(spinning ? 360 : 0))
            .animation(
                spinning
                    ? .linear(duration: 12).repeatForever(autoreverses: false)
                    : .easeOut(duration: 0.6),
                value: spinning)
            .onAppear { spinning = isSpinning }
            .onChange(of: isSpinning) { _, now in spinning = now }
    }
}
