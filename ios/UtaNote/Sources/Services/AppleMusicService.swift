import Foundation
import StoreKit

/// Apple Music 目录接入：授权、订阅状态、搜索。
/// 走 iTunes Search API + 系统媒体播放，不需要付费开发者资格（MusicKit developer token）。
/// 播放版权由用户自己的 Apple Music 订阅承担，App 不分发任何音频。
enum AppleMusicService {
    enum Availability {
        case ready                 // 已授权且可播全曲
        case noSubscription        // 已授权但账号无订阅
        case denied                // 用户拒绝授权
        case notDetermined
    }

    /// 搜索结果（iTunes Search API 的歌曲条目）
    struct FoundTrack: Identifiable, Hashable, Decodable {
        let trackId: Int
        let trackName: String
        let artistName: String
        let artworkUrl100: String?
        let trackTimeMillis: Int?
        /// 30 秒试听片段（苹果公开 CDN，无需订阅），部分曲目可能没有
        let previewUrl: String?

        var id: Int { trackId }
        var storeID: String { String(trackId) }
        var duration: Double? { trackTimeMillis.map { Double($0) / 1000 } }
        /// 100px 缩略图地址升级成高清
        var artworkURL: String? {
            artworkUrl100?.replacingOccurrences(of: "100x100", with: "600x600")
        }
    }

    static func availability() async -> Availability {
        let status = await withCheckedContinuation { continuation in
            SKCloudServiceController.requestAuthorization { continuation.resume(returning: $0) }
        }
        switch status {
        case .authorized:
            let capabilities = try? await SKCloudServiceController().requestCapabilities()
            return capabilities?.contains(.musicCatalogPlayback) == true ? .ready : .noSubscription
        case .denied, .restricted:
            return .denied
        default:
            return .notDetermined
        }
    }

    /// 用户媒体账号的商店区（如 "tr"），搜索结果的 store id 必须与账号同区才能播
    static func storefrontCountry() async -> String {
        (try? await SKCloudServiceController().requestStorefrontCountryCode()) ?? "us"
    }

    /// iTunes Search API：公开接口，无需任何令牌
    static func search(_ term: String, limit: Int = 20) async throws -> [FoundTrack] {
        let country = await storefrontCountry()
        var components = URLComponents(string: "https://itunes.apple.com/search")!
        components.queryItems = [
            URLQueryItem(name: "term", value: term),
            URLQueryItem(name: "country", value: country),
            URLQueryItem(name: "media", value: "music"),
            URLQueryItem(name: "entity", value: "song"),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        let (data, _) = try await URLSession.shared.data(from: components.url!)
        struct SearchResponse: Decodable {
            let results: [FoundTrack]
        }
        return try JSONDecoder().decode(SearchResponse.self, from: data).results
    }
}
