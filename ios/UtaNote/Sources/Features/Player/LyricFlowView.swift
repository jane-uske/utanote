import SwiftData
import SwiftUI

/// 歌词流：逐句同步高亮、自动居中滚动。
/// 轻点任意一句 = 学习这一句；长按 = 盖章收藏。
struct LyricFlowView: View {
    let song: Song
    let showTranslations: Bool
    /// 当前高亮行，由持有者的播放控制器驱动（本地音频或 Apple Music）
    let currentLineIndex: Int?
    @Binding var studyLine: LyricLine?
    @Binding var stampedLineID: String?

    @Environment(\.modelContext) private var context
    @Query private var saved: [SavedLine]

    init(
        song: Song, showTranslations: Bool, currentLineIndex: Int?,
        studyLine: Binding<LyricLine?>, stampedLineID: Binding<String?>
    ) {
        self.song = song
        self.showTranslations = showTranslations
        self.currentLineIndex = currentLineIndex
        _studyLine = studyLine
        _stampedLineID = stampedLineID
        let songID = song.id
        _saved = Query(filter: #Predicate<SavedLine> { $0.songID == songID })
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 26) {
                    Color.clear.frame(height: 120)
                    ForEach(Array(song.lines.enumerated()), id: \.element.id) { index, line in
                        LyricLineRow(
                            line: line,
                            state: state(for: index),
                            showTranslation: showTranslations,
                            isSaved: savedIDs.contains(line.id),
                            stamped: stampedLineID == line.id)
                            .id(line.id)
                            .onTapGesture { handleTap(line: line) }
                            .onLongPressGesture(minimumDuration: 0.35) { handleLongPress(line: line) }
                    }
                    Color.clear.frame(height: 160)
                }
                .padding(.horizontal, 28)
            }
            .onChange(of: currentLineIndex) { _, newIndex in
                guard let newIndex, song.lines.indices.contains(newIndex) else { return }
                withAnimation(.spring(response: 0.55, dampingFraction: 0.86)) {
                    proxy.scrollTo(song.lines[newIndex].id, anchor: .center)
                }
            }
            .onAppear {
                if let index = currentLineIndex, song.lines.indices.contains(index) {
                    proxy.scrollTo(song.lines[index].id, anchor: .center)
                }
            }
        }
    }

    private var savedIDs: Set<String> {
        Set(saved.map(\.lineID))
    }

    private func state(for index: Int) -> LyricLineRow.LineState {
        guard let current = currentLineIndex else {
            // 前奏期给第一句"将至"的半亮态，页面不至于一片死灰
            return index == 0 ? .near : .far
        }
        if index == current { return .current }
        return abs(index - current) == 1 ? .near : .far
    }

    private func handleTap(line: LyricLine) {
        Haptics.tap()
        studyLine = line
    }

    private func handleLongPress(line: LyricLine) {
        let nowSaved = UserDataStore.toggleSaved(song: song, line: line, in: context)
        if nowSaved {
            Haptics.stamp()
            stampedLineID = line.id
            let stamped = line.id
            Task {
                try? await Task.sleep(for: .seconds(1.4))
                if stampedLineID == stamped {
                    withAnimation { stampedLineID = nil }
                }
            }
        } else {
            Haptics.tap()
        }
    }
}

struct LyricLineRow: View {
    enum LineState: Equatable {
        case current, near, far
    }

    let line: LyricLine
    let state: LineState
    let showTranslation: Bool
    let isSaved: Bool
    let stamped: Bool

    var body: some View {
        VStack(spacing: 8) {
            if state == .current {
                RubyText(
                    tokens: line.tokens,
                    surfaceSize: 25,
                    heavy: true,
                    showRuby: true,
                    surfaceColor: .white.opacity(0.97),
                    rubyColor: .white.opacity(0.58),
                    alignment: .center)
            } else {
                Text(line.text)
                    .font(.lyric(19))
                    .foregroundStyle(.white.opacity(state == .near ? 0.42 : 0.24))
                    .multilineTextAlignment(.center)
            }
            if showTranslation || state == .current {
                Text(line.translation)
                    .font(.system(size: state == .current ? 13 : 11.5))
                    .foregroundStyle(.white.opacity(state == .current ? 0.55 : 0.26))
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .scaleEffect(state == .current ? 1.0 : 0.96)
        .overlay(alignment: .topTrailing) {
            if isSaved {
                SealStamp(size: 17)
                    .opacity(stamped ? 1 : 0.85)
                    .offset(x: 12, y: -8)
                    .transition(.scale(scale: 1.8).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: state)
        .animation(.spring(response: 0.35, dampingFraction: 0.6), value: isSaved)
        .contentShape(Rectangle())
    }
}
