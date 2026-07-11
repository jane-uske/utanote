import Foundation

/// 内置曲库加载。歌曲内容是「AI 分析后缓存」形态的结构化 JSON，
/// 之后接入线上曲库/AI 分析服务时替换数据来源即可，模型不变。
enum SongLibrary {
    static func loadBundled() -> [Song] {
        guard let urls = Bundle.main.urls(forResourcesWithExtension: "json", subdirectory: "Songs") else {
            return []
        }
        let decoder = JSONDecoder()
        let songs = urls.compactMap { url -> Song? in
            guard let data = try? Data(contentsOf: url) else { return nil }
            do {
                return try decoder.decode(Song.self, from: data)
            } catch {
                assertionFailure("歌曲解析失败 \(url.lastPathComponent): \(error)")
                return nil
            }
        }
        return songs.sorted { $0.order < $1.order }
    }

    static func audioURL(for song: Song) -> URL? {
        Bundle.main.url(forResource: song.id, withExtension: "m4a", subdirectory: "Audio")
    }
}
