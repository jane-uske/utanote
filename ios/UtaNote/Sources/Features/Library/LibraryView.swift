import SwiftData
import SwiftUI

/// 曲库：搜索 + 歌曲卡列表，推入歌曲详情。
struct LibraryView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query private var savedLines: [SavedLine]
    @State private var query = ""

    var body: some View {
        @Bindable var app = app
        NavigationStack {
            ZStack {
                PaperBackground()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 24) {
                        header
                        searchField
                        appleMusicEntry
                        if !app.importedSongs.isEmpty {
                            importedSection
                        }
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
        .fullScreenCover(isPresented: $app.isMusicSearchPresented) {
            MusicSearchView()
        }
    }

    // MARK: - Apple Music 入口与导入歌

    private var appleMusicEntry: some View {
        Button {
            app.isMusicSearchPresented = true
            Haptics.tap()
        } label: {
            UtaCard(padding: 14) {
                HStack(spacing: 12) {
                    Image(systemName: "music.note.house.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(UtaColor.indigo)
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(UtaColor.indigo.opacity(0.12)))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("学你喜欢的歌")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(UtaColor.ink)
                        Text("从 Apple Music 搜索 · 自己打点歌词")
                            .font(.system(size: 11.5))
                            .foregroundStyle(UtaColor.inkSoft)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(UtaColor.inkFaint)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
    }

    private var importedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "我的歌", kicker: "APPLE MUSIC")
            LazyVStack(spacing: 12) {
                ForEach(app.importedSongs) { song in
                    importedRow(song)
                }
            }
        }
    }

    private func importedRow(_ song: Song) -> some View {
        Button {
            app.openImportedSong(song)
            Haptics.tap()
        } label: {
            UtaCard(padding: 14) {
                HStack(spacing: 14) {
                    if let urlString = song.artworkURL, let url = URL(string: urlString) {
                        AsyncImage(url: url) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            CoverArtView(style: song.coverStyle, cornerRadius: 12)
                        }
                        .frame(width: 64, height: 64)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    } else {
                        CoverArtView(style: song.coverStyle, cornerRadius: 12)
                            .frame(width: 64, height: 64)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(song.title)
                            .font(.lyric(17, heavy: true))
                            .foregroundStyle(UtaColor.ink)
                            .lineLimit(1)
                        Text(song.artist)
                            .font(.system(size: 11.5))
                            .foregroundStyle(UtaColor.inkSoft)
                            .lineLimit(1)
                        HStack(spacing: 6) {
                            Chip(text: "\(song.lines.count) 句", color: UtaColor.indigo)
                            if let count = savedCountBySong[song.id], count > 0 {
                                HStack(spacing: 3) {
                                    SealStamp(size: 12)
                                    Text("\(count)")
                                        .font(.system(size: 11, weight: .medium, design: .rounded))
                                        .foregroundStyle(UtaColor.vermilion)
                                }
                            }
                        }
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(UtaColor.indigo.opacity(0.7))
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
        .contextMenu {
            Button(role: .destructive) {
                deleteImported(song)
            } label: {
                Label("删除这首歌", systemImage: "trash")
            }
        }
    }

    private func deleteImported(_ song: Song) {
        let songID = song.id
        let descriptor = FetchDescriptor<ImportedSongRecord>(
            predicate: #Predicate { $0.id == songID })
        (try? context.fetch(descriptor))?.forEach { context.delete($0) }
        try? context.save()
        app.reloadImportedSongs(in: context)
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
