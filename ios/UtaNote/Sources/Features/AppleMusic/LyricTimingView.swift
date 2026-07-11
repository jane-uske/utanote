import SafariServices
import SwiftData
import SwiftUI

/// 歌词打点工作台：粘贴歌词 → 边听边给每句敲时间点 → 生成同步时间轴。
/// 歌词由用户自己查找并粘贴（私人使用）；App 不抓取、不分发任何歌词文本。
struct LyricTimingView: View {
    let track: AppleMusicService.FoundTrack

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context

    @State private var lyricsText = ""
    @State private var lines: [String] = []
    @State private var isTiming = false
    @State private var events: [TimingEvent] = []
    @State private var isSaving = false
    @State private var showsLyricSearch = false
    @State private var pasteHint: String?

    enum TimingEvent {
        case lineStart(Double)
        case interlude(Double)
    }

    var body: some View {
        ZStack {
            PaperBackground()
            if isTiming {
                timingBoard
            } else {
                pasteStep
            }
        }
        .navigationTitle(track.trackName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showsLyricSearch) {
            SafariView(url: lyricSearchURL)
                .ignoresSafeArea()
        }
        .onDisappear {
            if app.presentedImportedSong == nil { app.musicPlayer.stop() }
        }
    }

    /// 歌词搜索：用户自己浏览、自己复制。
    /// 不用 uta-net 等日本站直链——它们禁止选中复制；Bing 结果里用户可挑能复制的站。
    private var lyricSearchURL: URL {
        let keyword = "\(track.trackName) \(track.artistName) 歌詞"
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "https://www.bing.com/search?q=\(keyword)")
            ?? URL(string: "https://www.bing.com")!
    }

    // MARK: - 第一步：贴歌词

    private var pasteStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "粘贴歌词", kicker: "STEP 1 / 2")
            Text("一行一句。空行会被忽略；打点时你每听到一句的开头，敲一下按钮。")
                .font(.system(size: 12.5))
                .foregroundStyle(UtaColor.inkSoft)
            HStack(spacing: 10) {
                PillButton("去找歌词", icon: "safari") {
                    showsLyricSearch = true
                }
                PillButton("粘贴", icon: "doc.on.clipboard") {
                    if let pasted = UIPasteboard.general.string, !pasted.isEmpty {
                        lyricsText = pasted
                        pasteHint = nil
                        Haptics.tap()
                    } else {
                        pasteHint = "剪贴板是空的。多数日本歌词站禁止复制——搜索结果里挑「魔镜歌词网」或网易云这类能长按选中的。"
                    }
                }
            }
            if let pasteHint {
                Text(pasteHint)
                    .font(.system(size: 11.5))
                    .foregroundStyle(UtaColor.vermilion)
            }
            TextEditor(text: $lyricsText)
                .font(.lyric(15))
                .foregroundStyle(UtaColor.ink)
                .scrollContentBackground(.hidden)
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(UtaColor.paperInset))
                .frame(maxHeight: .infinity)
            let parsed = parsedLines
            PillButton(
                parsed.count >= 2 ? "开始打点（\(parsed.count) 句）" : "至少两句歌词",
                icon: "metronome",
                prominent: parsed.count >= 2
            ) {
                guard parsed.count >= 2 else { return }
                lines = parsed
                events = []
                isTiming = true
                app.musicPlayer.load(
                    storeID: track.storeID, song: nil, itemDuration: track.duration ?? 0)
                app.musicPlayer.play()
            }
            .frame(maxWidth: .infinity)
        }
        .padding(20)
    }

    private var parsedLines: [String] {
        lyricsText
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    // MARK: - 第二步：打点

    private var markedStarts: [Double] {
        events.compactMap {
            if case .lineStart(let t) = $0 { return t }
            return nil
        }
    }

    private var timingBoard: some View {
        let starts = markedStarts
        let player = app.musicPlayer
        return VStack(spacing: 0) {
            VStack(spacing: 10) {
                ProgressStrip(
                    duration: player.duration,
                    current: player.currentTime,
                    accent: UtaColor.indigo
                ) { player.seek(to: $0) }
                HStack(spacing: 22) {
                    ControlIcon(name: "gobackward.5", size: 17) {
                        player.seek(to: max(0, player.currentTime - 5))
                    }
                    Button {
                        player.togglePlayPause()
                    } label: {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(UtaColor.ink)
                            .frame(width: 52, height: 52)
                            .background(Circle().fill(UtaColor.paperInset))
                    }
                    .buttonStyle(PressableStyle(scale: 0.92))
                    ControlIcon(name: "arrow.uturn.backward", size: 17) { undo() }
                        .opacity(events.isEmpty ? 0.3 : 1)
                        .disabled(events.isEmpty)
                }
                .foregroundStyle(UtaColor.ink)
                if let error = player.lastError {
                    Text(error)
                        .font(.system(size: 12))
                        .foregroundStyle(UtaColor.vermilion)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 12)

            lineList(starts: starts)

            actionBar(starts: starts)
        }
    }

    private func lineList(starts: [Double]) -> some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {
                    ForEach(Array(lines.enumerated()), id: \.offset) { index, text in
                        HStack(spacing: 12) {
                            Text(index < starts.count ? timecode(starts[index]) : "--:--")
                                .font(.timecode)
                                .foregroundStyle(
                                    index < starts.count ? UtaColor.indigo : UtaColor.inkFaint)
                                .frame(width: 46, alignment: .trailing)
                            Text(text)
                                .font(.lyric(15, heavy: index == starts.count))
                                .foregroundStyle(rowColor(index: index, done: starts.count))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .id(index)
                        .padding(.horizontal, 20)
                    }
                    Color.clear.frame(height: 40)
                }
                .padding(.top, 10)
            }
            .onChange(of: starts.count) { _, next in
                withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                    proxy.scrollTo(min(next, lines.count - 1), anchor: .center)
                }
            }
        }
    }

    private func rowColor(index: Int, done: Int) -> Color {
        if index == done { return UtaColor.ink }
        return index < done ? UtaColor.inkSoft : UtaColor.inkFaint
    }

    private func actionBar(starts: [Double]) -> some View {
        let player = app.musicPlayer
        let allMarked = starts.count >= lines.count
        let canMark = !allMarked && player.currentTime > (starts.last ?? -1) + 0.2
        let canInterlude = !starts.isEmpty && !hasOpenInterlude(for: starts.count - 1)
            && player.currentTime > (starts.last ?? 0)
        return VStack(spacing: 10) {
            if allMarked {
                PillButton(isSaving ? "保存中…" : "完成，保存这首歌", icon: "checkmark.seal", prominent: true) {
                    save()
                }
                .disabled(isSaving)
            } else {
                Button {
                    events.append(.lineStart(player.currentTime))
                    Haptics.tap()
                } label: {
                    Text("这句从这里开始")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(canMark ? UtaColor.vermilion : UtaColor.inkFaint))
                }
                .buttonStyle(PressableStyle(scale: 0.97))
                .disabled(!canMark)
            }
            Button {
                events.append(.interlude(player.currentTime))
                Haptics.selection()
            } label: {
                Text("间奏 · 上一句到此结束")
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(canInterlude ? UtaColor.indigo : UtaColor.inkFaint)
            }
            .disabled(!canInterlude)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 12)
        .background(UtaColor.paperRaised.ignoresSafeArea(edges: .bottom))
    }

    private func hasOpenInterlude(for lineIndex: Int) -> Bool {
        interludeEnds()[lineIndex] != nil
    }

    private func undo() {
        _ = events.popLast()
        Haptics.selection()
    }

    // MARK: - 保存

    /// 行号 → 显式结束点（「间奏」标记）
    private func interludeEnds() -> [Int: Double] {
        var ends: [Int: Double] = [:]
        var lineCount = 0
        for event in events {
            switch event {
            case .lineStart: lineCount += 1
            case .interlude(let t):
                if lineCount > 0, ends[lineCount - 1] == nil { ends[lineCount - 1] = t }
            }
        }
        return ends
    }

    private func save() {
        isSaving = true
        let starts = markedStarts
        let ends = interludeEnds()
        let player = app.musicPlayer
        let total = player.duration > 0 ? player.duration : (starts.last ?? 0) + 8
        var lyricLines: [LyricLine] = []
        for (index, text) in lines.enumerated() {
            let start = starts[index]
            let nextStart = index + 1 < starts.count ? starts[index + 1] : total
            let end = min(ends[index] ?? nextStart, total)
            lyricLines.append(
                LyricLine(
                    id: String(format: "l%02d", index + 1),
                    start: start,
                    end: max(end, start + 0.5),
                    text: text,
                    tokens: JapaneseAnnotator.tokens(for: text),
                    translation: "",
                    words: [],
                    grammar: [],
                    emotion: EmotionTag(kind: .quiet, intensity: 0.3, note: ""),
                    culture: nil,
                    singingTip: nil))
        }

        // 重打点时覆盖旧记录
        let recordID = "am-\(track.storeID)"
        let descriptor = FetchDescriptor<ImportedSongRecord>(
            predicate: #Predicate { $0.id == recordID })
        (try? context.fetch(descriptor))?.forEach { context.delete($0) }
        let record = ImportedSongRecord(
            catalogID: track.storeID,
            title: track.trackName,
            artist: track.artistName,
            artworkURL: track.artworkURL,
            durationSec: total,
            lines: lyricLines)
        context.insert(record)
        try? context.save()

        app.reloadImportedSongs(in: context)
        app.isMusicSearchPresented = false
        app.openImportedSong(record.toSong(), autoplay: false)
        isSaving = false
    }
}
