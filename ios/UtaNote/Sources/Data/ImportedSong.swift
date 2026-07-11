import Foundation
import SwiftData

/// 用户从 Apple Music 导入并自己打点的歌。
/// 只存用户自建的时间轴与歌词行——音频永远来自用户的 Apple Music 订阅，App 不落任何音频。
@Model
final class ImportedSongRecord {
    @Attribute(.unique) var id: String  // "am-<catalogID>"
    var catalogID: String
    var title: String
    var artist: String
    var artworkURL: String?
    var durationSec: Double
    var linesJSON: Data
    var createdAt: Date

    init(
        catalogID: String, title: String, artist: String,
        artworkURL: String?, durationSec: Double, lines: [LyricLine]
    ) {
        self.id = "am-\(catalogID)"
        self.catalogID = catalogID
        self.title = title
        self.artist = artist
        self.artworkURL = artworkURL
        self.durationSec = durationSec
        self.linesJSON = (try? JSONEncoder().encode(lines)) ?? Data()
        self.createdAt = .now
    }

    var lines: [LyricLine] {
        (try? JSONDecoder().decode([LyricLine].self, from: linesJSON)) ?? []
    }

    /// 转成内容模型，接入播放器/学习/收藏/复习全链路
    func toSong() -> Song {
        Song(
            id: id,
            order: 10_000,
            title: title,
            titleReading: "",
            titleTranslation: artist,
            artist: artist,
            level: "MY",
            summary: "从 Apple Music 导入，歌词由你打点同步。",
            storyIntro: "",
            tags: ["我的歌"],
            coverStyle: CoverStyle(
                glyph: String(title.prefix(1)),
                colors: ["#2E3A52", "#1C2436"],
                accentHex: "#8A9BC4"),
            durationSec: durationSec,
            lines: lines,
            artworkURL: artworkURL)
    }
}
