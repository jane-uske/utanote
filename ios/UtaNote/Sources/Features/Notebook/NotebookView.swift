import SwiftData
import SwiftUI

/// 歌词本：收藏过的句子与批注，按歌分组——一册私人手帐。
struct NotebookView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \SavedLine.createdAt, order: .reverse) private var savedLines: [SavedLine]

    @State private var studyTarget: NotebookEntryRef?
    @State private var noteTarget: NotebookEntryRef?

    var body: some View {
        ZStack {
            PaperBackground()
            if groups.isEmpty {
                VStack(spacing: 0) {
                    header
                    Spacer()
                    emptyState
                    Spacer()
                    Spacer()
                }
                .padding(.horizontal, 20)
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 26) {
                        header
                        ForEach(groups) { group in
                            groupSection(group)
                        }
                        Color.clear.frame(height: 16)
                    }
                    .padding(.horizontal, 20)
                }
            }
        }
        .sheet(item: $studyTarget) { target in
            LineStudyView(song: target.song, line: target.line)
        }
        .sheet(item: $noteTarget) { target in
            NoteEditorSheet(savedLine: target.saved, song: target.song, line: target.line)
        }
    }

    // MARK: - 数据整理

    private var groups: [NotebookGroup] {
        var order: [String] = []
        var songs: [String: Song] = [:]
        var buckets: [String: [NotebookEntry]] = [:]
        for saved in savedLines {
            guard let song = songs[saved.songID] ?? app.song(withID: saved.songID),
                  let line = song.line(withID: saved.lineID) else { continue }
            if buckets[saved.songID] == nil {
                order.append(saved.songID)
                songs[saved.songID] = song
            }
            buckets[saved.songID, default: []].append(NotebookEntry(saved: saved, line: line))
        }
        return order.compactMap { id in
            guard let song = songs[id], let entries = buckets[id] else { return nil }
            return NotebookGroup(song: song, entries: entries)
        }
    }

    private var totalCount: Int {
        groups.reduce(0) { $0 + $1.entries.count }
    }

    // MARK: - 页头

    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("わたしのうた")
                .font(.lyric(11))
                .foregroundStyle(UtaColor.inkFaint)
                .kerning(2)
            HStack(alignment: .lastTextBaseline, spacing: 10) {
                Text("歌词本")
                    .font(.lyric(30, heavy: true))
                    .foregroundStyle(UtaColor.ink)
                Spacer()
                if totalCount > 0 {
                    Text("收着 \(totalCount) 句")
                        .font(.system(size: 12))
                        .foregroundStyle(UtaColor.inkSoft)
                }
            }
        }
        .padding(.top, 16)
    }

    // MARK: - 分组

    private func groupSection(_ group: NotebookGroup) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 9) {
                CoverArtView(style: group.song.coverStyle, cornerRadius: 7)
                    .frame(width: 28, height: 28)
                Text(group.song.title)
                    .font(.lyric(14, heavy: true))
                    .foregroundStyle(UtaColor.ink)
                    .lineLimit(1)
                Spacer()
                Text("\(group.entries.count) 句")
                    .font(.system(size: 11))
                    .foregroundStyle(UtaColor.inkFaint)
            }
            UtaCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(group.entries.enumerated()), id: \.element.id) { index, entry in
                        entryRow(entry, in: group)
                        if index < group.entries.count - 1 {
                            Rectangle()
                                .fill(UtaColor.hairline)
                                .frame(height: 0.6)
                                .padding(.leading, 16)
                        }
                    }
                }
            }
        }
    }

    // MARK: - 条目

    private func entryRow(_ entry: NotebookEntry, in group: NotebookGroup) -> some View {
        Button {
            studyTarget = NotebookEntryRef(saved: entry.saved, song: group.song, line: entry.line)
        } label: {
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(entry.line.text)
                            .font(.lyric(16))
                            .foregroundStyle(UtaColor.ink)
                            .multilineTextAlignment(.leading)
                        Text(entry.line.translation)
                            .font(.system(size: 11.5))
                            .foregroundStyle(UtaColor.inkSoft)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    SealStamp(size: 14)
                        .padding(.top, 2)
                }
                if !entry.saved.note.isEmpty {
                    Text(entry.saved.note)
                        .font(.system(size: 12))
                        .foregroundStyle(UtaColor.inkSoft)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .padding(.leading, 9)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .overlay(alignment: .leading) {
                            Capsule()
                                .fill(UtaColor.vermilion)
                                .frame(width: 2)
                        }
                }
                Text(relativeDay(entry.saved.createdAt))
                    .font(.system(size: 10.5))
                    .foregroundStyle(UtaColor.inkFaint)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle(scale: 0.98))
        .contextMenu {
            Button {
                noteTarget = NotebookEntryRef(saved: entry.saved, song: group.song, line: entry.line)
            } label: {
                Label("写批注", systemImage: "square.and.pencil")
            }
            Button(role: .destructive) {
                context.delete(entry.saved)
                Haptics.tap()
            } label: {
                Label("删除收藏", systemImage: "trash")
            }
        }
    }

    // MARK: - 空状态

    private var emptyState: some View {
        VStack(spacing: 16) {
            Circle()
                .strokeBorder(style: StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                .foregroundStyle(UtaColor.inkFaint)
                .frame(width: 60, height: 60)
                .overlay(
                    Text("収")
                        .font(.lyric(20))
                        .foregroundStyle(UtaColor.inkFaint))
            VStack(spacing: 7) {
                Text("还没有收进歌词本的句子")
                    .font(.lyric(15, heavy: true))
                    .foregroundStyle(UtaColor.ink)
                Text("去播放器长按一句喜欢的歌词，盖上第一枚印章")
                    .font(.system(size: 12.5))
                    .foregroundStyle(UtaColor.inkSoft)
                    .multilineTextAlignment(.center)
            }
            PillButton("去听歌", icon: "play.fill") {
                app.tab = .library
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - 相对日期

    private func relativeDay(_ date: Date) -> String {
        let calendar = Calendar.current
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: date),
            to: calendar.startOfDay(for: .now)).day ?? 0
        switch days {
        case ..<1: return "今天"
        case 1: return "昨天"
        case 2..<30: return "\(days)天前"
        case 30..<365: return "\(days / 30)个月前"
        default: return "\(days / 365)年前"
        }
    }
}

// MARK: - 视图数据

private struct NotebookEntry: Identifiable {
    let saved: SavedLine
    let line: LyricLine
    var id: PersistentIdentifier { saved.persistentModelID }
}

private struct NotebookGroup: Identifiable {
    let song: Song
    let entries: [NotebookEntry]
    var id: String { song.id }
}

private struct NotebookEntryRef: Identifiable {
    let saved: SavedLine
    let song: Song
    let line: LyricLine
    var id: PersistentIdentifier { saved.persistentModelID }
}

// MARK: - 批注编辑

private struct NoteEditorSheet: View {
    let savedLine: SavedLine
    let song: Song
    let line: LyricLine

    @Environment(\.dismiss) private var dismiss
    @State private var draft: String

    init(savedLine: SavedLine, song: Song, line: LyricLine) {
        self.savedLine = savedLine
        self.song = song
        self.line = line
        _draft = State(initialValue: savedLine.note)
    }

    var body: some View {
        ZStack {
            UtaColor.paper.ignoresSafeArea()
            GrainOverlay(opacity: 0.03)
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("ひとこと")
                        .font(.lyric(11))
                        .foregroundStyle(UtaColor.inkFaint)
                        .kerning(2)
                    Text("写批注")
                        .font(.lyric(20, heavy: true))
                        .foregroundStyle(UtaColor.ink)
                }
                VStack(alignment: .leading, spacing: 5) {
                    Text(line.text)
                        .font(.lyric(16, heavy: true))
                        .foregroundStyle(UtaColor.ink)
                    Text("\(line.translation) · 出自「\(song.title)」")
                        .font(.system(size: 11.5))
                        .foregroundStyle(UtaColor.inkSoft)
                        .lineLimit(1)
                }
                UtaCard(padding: 10) {
                    TextEditor(text: $draft)
                        .font(.system(size: 14))
                        .foregroundStyle(UtaColor.ink)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 120, maxHeight: 160)
                        .overlay(alignment: .topLeading) {
                            if draft.isEmpty {
                                Text("写下这句歌词对你的意义…")
                                    .font(.system(size: 14))
                                    .foregroundStyle(UtaColor.inkFaint)
                                    .padding(.top, 8)
                                    .padding(.leading, 5)
                                    .allowsHitTesting(false)
                            }
                        }
                }
                HStack {
                    Spacer()
                    PillButton("保存", icon: "checkmark", prominent: true) {
                        savedLine.note = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                        Haptics.tap()
                        dismiss()
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.top, 22)
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationBackground(UtaColor.paper)
    }
}
