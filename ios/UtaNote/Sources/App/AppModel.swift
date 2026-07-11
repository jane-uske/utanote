import Observation
import SwiftData
import SwiftUI

enum AppTab: Hashable {
    case home, library, review, notebook
}

@MainActor
@Observable
final class AppModel {
    let songs: [Song]
    let audio = AudioPlayerController()
    let musicPlayer = AppleMusicPlayerController()
    let tts = SpeechService()
    let evaluator: PronunciationEvaluating

    var tab: AppTab = .home
    var isPlayerPresented = false
    /// Apple Music 搜索/打点流程的全屏展示
    var isMusicSearchPresented = false
    /// 正在全屏展示的 Apple Music 导入歌
    var presentedImportedSong: Song?
    /// 用户从 Apple Music 导入的歌（SwiftData 缓存视图）
    var importedSongs: [Song] = []
    /// 打开播放器后立即弹出学习页的行
    var pendingStudyLineID: String?
    /// 学习页出现后直接进入跟读（用于截图路由/深链）
    var pendingPracticeImmediately = false

    init() {
        songs = SongLibrary.loadBundled()
        evaluator = SpeechPronunciationEvaluator()
        // 任何入口（学习页/歌词本/复习）的 TTS 开口前先停歌，避免叠音
        tts.onWillSpeak = { [audio, musicPlayer] in
            if audio.isPlaying { audio.pause() }
            if musicPlayer.isPlaying { musicPlayer.pause() }
        }
    }

    func song(withID id: String) -> Song? {
        songs.first { $0.id == id } ?? importedSongs.first { $0.id == id }
    }

    func reloadImportedSongs(in context: ModelContext) {
        let descriptor = FetchDescriptor<ImportedSongRecord>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
        importedSongs = ((try? context.fetch(descriptor)) ?? []).map { $0.toSong() }
    }

    /// 打开 Apple Music 导入歌的播放器（store id 直接入队，无需目录请求）
    func openImportedSong(_ song: Song, autoplay: Bool = true) {
        audio.pause()
        presentedImportedSong = song
        let storeID = String(song.id.dropFirst("am-".count))
        musicPlayer.load(storeID: storeID, song: song)
        if autoplay { musicPlayer.play() }
    }

    func openPlayer(_ song: Song, atLineID lineID: String? = nil, autoplay: Bool = true) {
        audio.load(song, autoplay: autoplay)
        if let lineID, let line = song.line(withID: lineID) {
            audio.seek(to: line.start)
        }
        isPlayerPresented = true
    }

    /// 打开播放器并直接进入某一句的学习页（不自动播放，专注学习）
    func openPlayerForStudy(_ song: Song, lineID: String) {
        audio.load(song, autoplay: false)
        if let line = song.line(withID: lineID) {
            audio.seek(to: line.start)
        }
        pendingStudyLineID = lineID
        isPlayerPresented = true
    }
}
