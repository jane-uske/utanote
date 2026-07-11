import Observation
import SwiftUI

enum AppTab: Hashable {
    case home, library, review, notebook
}

@MainActor
@Observable
final class AppModel {
    let songs: [Song]
    let audio = AudioPlayerController()
    let tts = SpeechService()
    let evaluator: PronunciationEvaluating

    var tab: AppTab = .home
    var isPlayerPresented = false
    /// 打开播放器后立即弹出学习页的行
    var pendingStudyLineID: String?
    /// 学习页出现后直接进入跟读（用于截图路由/深链）
    var pendingPracticeImmediately = false

    init() {
        songs = SongLibrary.loadBundled()
        evaluator = SpeechPronunciationEvaluator()
        // 任何入口（学习页/歌词本/复习）的 TTS 开口前先停歌，避免叠音
        tts.onWillSpeak = { [audio] in
            if audio.isPlaying { audio.pause() }
        }
    }

    func song(withID id: String) -> Song? {
        songs.first { $0.id == id }
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
