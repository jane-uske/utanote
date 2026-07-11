import Foundation
import MediaPlayer
import Observation

/// Apple Music 播放：系统媒体播放器按 store id 播全曲 + 歌词时间轴。
/// 用 MPMusicPlayerController 而非 MusicKit 的 ApplicationMusicPlayer——
/// 前者不需要付费开发者资格（developer token），只要用户自己的订阅。
/// 锁屏控制与后台播放由系统音乐播放栈接管。
@MainActor
@Observable
final class AppleMusicPlayerController {
    private(set) var song: Song?
    private(set) var isPlaying = false
    private(set) var currentTime: Double = 0
    private(set) var currentLineIndex: Int?
    private(set) var lastError: String?

    /// 单句循环的行 id
    var loopingLineID: String? {
        didSet { applyLoopRange() }
    }

    private let player = MPMusicPlayerController.applicationQueuePlayer
    private var ticker: Timer?
    private var loopRange: ClosedRange<Double>?
    private var itemDuration: Double = 0

    var duration: Double { song?.durationSec ?? itemDuration }

    /// 按 Apple Music store id 装入一首真歌。song 为 nil 时只播不同步（打点工作台阶段）。
    func load(storeID: String, song: Song?, itemDuration: Double = 0) {
        stopTicker()
        self.song = song
        self.itemDuration = song?.durationSec ?? itemDuration
        currentTime = 0
        currentLineIndex = nil
        loopingLineID = nil
        lastError = nil
        player.setQueue(with: [storeID])
        player.prepareToPlay { [weak self] error in
            Task { @MainActor [weak self] in
                if error != nil {
                    self?.lastError = "这首歌暂时无法播放，检查 Apple Music 订阅或网络。"
                }
            }
        }
    }

    func play() {
        player.play()
        startTicker()
    }

    func pause() {
        player.pause()
        stopTicker()
        refreshPlaybackState()
        tickTime()
    }

    func togglePlayPause() {
        isPlaying ? pause() : play()
    }

    func seek(to time: Double) {
        let clamped = max(0, min(time, max(0, duration - 0.1)))
        player.currentPlaybackTime = clamped
        // 与本地播放器同语义：拖出循环句时迁移/解除单句循环
        if let loopRange, !loopRange.contains(clamped), let song {
            loopingLineID = LyricTimeline.index(at: clamped, lines: song.lines)
                .map { song.lines[$0].id }
        }
        tickTime()
    }

    func seek(toLine index: Int) {
        guard let song, song.lines.indices.contains(index) else { return }
        seek(to: song.lines[index].start)
    }

    func stepLine(_ delta: Int) {
        guard let song, !song.lines.isEmpty else { return }
        let current = currentLineIndex ?? -1
        let target = max(0, min(song.lines.count - 1, current + delta))
        if loopingLineID != nil {
            loopingLineID = song.lines[target].id
        }
        seek(toLine: target)
    }

    func toggleLoop(lineID: String) {
        loopingLineID = loopingLineID == lineID ? nil : lineID
    }

    func presentLoadFailure(_ message: String) {
        lastError = message
    }

    /// 退出真歌播放器时停止播放
    func stop() {
        player.stop()
        stopTicker()
        song = nil
        currentLineIndex = nil
        loopingLineID = nil
        isPlaying = false
    }

    // MARK: - 时间轴

    private func startTicker() {
        stopTicker()
        let timer = Timer(timeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        ticker = timer
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }

    private func tick() {
        refreshPlaybackState()
        tickTime()
        if let loopRange, currentTime >= loopRange.upperBound - 0.03 {
            player.currentPlaybackTime = loopRange.lowerBound
            currentTime = loopRange.lowerBound
            refreshLineIndex()
        }
    }

    private func tickTime() {
        currentTime = player.currentPlaybackTime
        refreshLineIndex()
    }

    private func refreshPlaybackState() {
        isPlaying = player.playbackState == .playing
    }

    private func refreshLineIndex() {
        guard let song, !song.lines.isEmpty else {
            currentLineIndex = nil
            return
        }
        let index = LyricTimeline.index(at: currentTime, lines: song.lines)
        if index != currentLineIndex {
            currentLineIndex = index
        }
    }

    private func applyLoopRange() {
        guard let song, let id = loopingLineID, let line = song.line(withID: id) else {
            loopRange = nil
            return
        }
        loopRange = line.start...line.end
    }
}
