import SwiftUI

/// 从 Apple Music 搜真歌 → 选一首进入歌词打点工作台。
struct MusicSearchView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var availability: AppleMusicService.Availability = .notDetermined
    @State private var query = ""
    @State private var results: [AppleMusicService.FoundTrack] = []
    @State private var isSearching = false
    @State private var searchError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                PaperBackground()
                switch availability {
                case .ready:
                    searchContent
                case .noSubscription:
                    message(
                        icon: "music.note.tv",
                        title: "需要 Apple Music 订阅",
                        body: "登录手机「音乐」App 的账号需要有效的 Apple Music 订阅，才能播放完整歌曲。")
                case .denied:
                    message(
                        icon: "hand.raised",
                        title: "未获得媒体库权限",
                        body: "请到 设置 → UtaNote 打开「媒体与 Apple Music」权限。")
                case .notDetermined:
                    ProgressView()
                }
            }
            .navigationTitle("学你喜欢的歌")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("关闭") { dismiss() }
                }
            }
            .navigationDestination(for: AppleMusicService.FoundTrack.self) { track in
                LyricTimingView(track: track)
            }
        }
        .task { availability = await AppleMusicService.availability() }
    }

    // MARK: - 搜索

    private var searchContent: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 16) {
                searchField
                if let searchError {
                    Text(searchError)
                        .font(.system(size: 12.5))
                        .foregroundStyle(UtaColor.inkSoft)
                        .padding(.top, 8)
                }
                if isSearching {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .padding(.top, 32)
                }
                LazyVStack(spacing: 10) {
                    ForEach(results) { track in
                        resultRow(track)
                    }
                }
                if results.isEmpty, !isSearching, searchError == nil {
                    hint
                }
                Color.clear.frame(height: 16)
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
        }
        .scrollDismissesKeyboard(.immediately)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(UtaColor.inkFaint)
            TextField("歌名或歌手，日文直接搜", text: $query)
                .font(.system(size: 14))
                .foregroundStyle(UtaColor.ink)
                .submitLabel(.search)
                .autocorrectionDisabled()
                .onSubmit { Task { await search() } }
        }
        .padding(.horizontal, 12)
        .frame(height: 42)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(UtaColor.paperInset))
    }

    private func resultRow(_ track: AppleMusicService.FoundTrack) -> some View {
        let imported = app.importedSongs.contains { $0.id == "am-\(track.storeID)" }
        return NavigationLink(value: track) {
            UtaCard(padding: 12) {
                HStack(spacing: 12) {
                    AsyncImage(url: track.artworkUrl100.flatMap(URL.init(string:))) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        RoundedRectangle(cornerRadius: 10).fill(UtaColor.paperInset)
                    }
                    .frame(width: 52, height: 52)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(track.trackName)
                            .font(.lyric(15, heavy: true))
                            .foregroundStyle(UtaColor.ink)
                            .lineLimit(1)
                        Text(track.artistName)
                            .font(.system(size: 12))
                            .foregroundStyle(UtaColor.inkSoft)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    if imported {
                        Chip(text: "已导入", color: UtaColor.matcha, filled: true)
                    } else if let duration = track.duration {
                        Text(timecode(duration))
                            .font(.timecode)
                            .foregroundStyle(UtaColor.inkFaint)
                    }
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
    }

    private var hint: some View {
        VStack(spacing: 10) {
            Text("うたをさがす")
                .font(.lyric(12))
                .foregroundStyle(UtaColor.inkFaint)
                .kerning(2)
            Text("搜一首你喜欢的日语歌\n播放走你自己的 Apple Music 订阅\n歌词由你粘贴并亲手打点")
                .font(.system(size: 13))
                .foregroundStyle(UtaColor.inkSoft)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 64)
    }

    private func message(icon: String, title: String, body text: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 34))
                .foregroundStyle(UtaColor.inkFaint)
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(UtaColor.ink)
            Text(text)
                .font(.system(size: 13))
                .foregroundStyle(UtaColor.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }

    private func search() async {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return }
        isSearching = true
        searchError = nil
        do {
            results = try await AppleMusicService.search(term)
            if results.isEmpty { searchError = "没搜到，换个关键词试试。" }
        } catch {
            results = []
            searchError = "搜索失败：\(error.localizedDescription)"
        }
        isSearching = false
    }
}
