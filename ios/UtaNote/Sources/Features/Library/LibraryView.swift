import SwiftData
import SwiftUI

/// 曲库：搜索 + 歌曲卡列表，推入歌曲详情。
struct LibraryView: View {
    @Environment(AppModel.self) private var app
    @Query private var savedLines: [SavedLine]
    @State private var query = ""

    var body: some View {
        NavigationStack {
            ZStack {
                PaperBackground()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 24) {
                        header
                        searchField
                        if filteredSongs.isEmpty {
                            emptyState
                        } else {
                            LazyVStack(spacing: 12) {
                                ForEach(filteredSongs) { song in
                                    songRow(song)
                                }
                            }
                        }
                        Color.clear.frame(height: 16)
                    }
                    .padding(.horizontal, 20)
                }
                .scrollDismissesKeyboard(.immediately)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Song.self) { song in
                SongDetailView(song: song)
            }
        }
    }

    // MARK: - 头部

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("うたのたな")
                .font(.lyric(11))
                .foregroundStyle(UtaColor.inkFaint)
                .kerning(2)
            Text("曲库")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(UtaColor.ink)
        }
        .padding(.top, 16)
    }

    // MARK: - 搜索

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(UtaColor.inkFaint)
            TextField("搜索歌名、歌手或标签", text: $query)
                .font(.system(size: 14))
                .foregroundStyle(UtaColor.ink)
                .submitLabel(.search)
                .autocorrectionDisabled()
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(UtaColor.inkFaint)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(UtaColor.paperInset))
    }

    private var filteredSongs: [Song] {
        let keyword = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !keyword.isEmpty else { return app.songs }
        return app.songs.filter { song in
            song.title.localizedCaseInsensitiveContains(keyword)
                || song.titleReading.localizedCaseInsensitiveContains(keyword)
                || song.titleTranslation.localizedCaseInsensitiveContains(keyword)
                || song.artist.localizedCaseInsensitiveContains(keyword)
                || song.tags.contains { $0.localizedCaseInsensitiveContains(keyword) }
        }
    }

    // MARK: - 歌曲卡

    private var savedCountBySong: [String: Int] {
        savedLines.reduce(into: [:]) { counts, line in
            counts[line.songID, default: 0] += 1
        }
    }

    private func songRow(_ song: Song) -> some View {
        NavigationLink(value: song) {
            UtaCard(padding: 14) {
                HStack(spacing: 14) {
                    CoverArtView(style: song.coverStyle, cornerRadius: 12)
                        .frame(width: 64, height: 64)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(song.title)
                            .font(.lyric(17, heavy: true))
                            .foregroundStyle(UtaColor.ink)
                            .lineLimit(1)
                        Text(song.titleTranslation)
                            .font(.system(size: 11.5))
                            .foregroundStyle(UtaColor.inkSoft)
                            .lineLimit(1)
                        HStack(spacing: 6) {
                            Text(song.artist)
                                .font(.system(size: 11))
                                .foregroundStyle(UtaColor.inkSoft)
                                .lineLimit(1)
                            Chip(text: song.level, color: UtaColor.indigo)
                            ForEach(song.tags.prefix(2), id: \.self) { tag in
                                Chip(text: tag)
                            }
                        }
                    }
                    Spacer(minLength: 8)
                    if let count = savedCountBySong[song.id], count > 0 {
                        HStack(spacing: 4) {
                            SealStamp(size: 14)
                            Text("\(count)")
                                .font(.system(size: 12, weight: .medium, design: .rounded).monospacedDigit())
                                .foregroundStyle(UtaColor.vermilion)
                        }
                    }
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(UtaColor.inkFaint)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
    }

    // MARK: - 空状态

    private var emptyState: some View {
        VStack(spacing: 8) {
            Text("しずか…")
                .font(.lyric(12))
                .foregroundStyle(UtaColor.inkFaint)
                .kerning(2)
            Text("没有找到相关的歌，换个词再试试。")
                .font(.system(size: 13))
                .foregroundStyle(UtaColor.inkSoft)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 56)
    }
}
