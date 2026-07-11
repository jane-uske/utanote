import AVFoundation
import Foundation
import MediaPlayer
import Observation

/// Apple Music 播放：系统媒体播放器按 store id 播全曲 + 歌词时间轴。
/// 用 MPMusicPlayerController 而非 MusicKit 的 ApplicationMusicPlayer——
/// 前者不需要付费开发者资格（developer token），只要用户自己的订阅。
/// 无订阅时降级为 AVPlayer 流播 30 秒试听片段（苹果公开 CDN）。
@MainActor
@Observable
final class AppleMusicPlayerController {
    enum Source {
        case fullTrack(storeID: String)
        case preview(URL)
    }

    private(set) var song: Song?
    private(set) var isPlaying = false
    private(set) var currentTime: Double = 0
    private(set) var currentLineIndex: Int?
    private(set) var lastError: String?
    /// 当前走的是 30 秒试听片段（UI 据此标注）
    private(set) var isPreview = false

    /// 单句循环的行 id
    var loopingLineID: String? {
        didSet { applyLoopRange() }
    }

    private let player = MPMusicPlayerController.applicationQueuePlayer
    private var previewPlayer: AVPlayer?
    private var ticker: Timer?
    private var loopRange: ClosedRange<Double>?
    private var itemDuration: Double = 0

    var duration: Double {
        if isPreview {
            // 试听片段实际时长（一般 30s），时间轴/进度条按片段算
            let itemSeconds = previewPlayer?.currentItem?.duration.seconds ?? .nan
            return itemSeconds.isFinite && itemSeconds > 0 ? itemSeconds : 30
        }
        return song?.durationSec ?? itemDuration
    }

    /// 装入一首真歌。song 为 nil 时只播不同步（打点工作台阶段）。
    func load(source: Source, song: Song?, itemDuration: Double = 0) {
        stopTicker()
        player.stop()
        previewPlayer?.pause()
        previewPlayer = nil
        self.song = song
        self.itemDuration = song?.durationSec ?? itemDuration
        currentTime = 0
        currentLineIndex = nil
        loopingLineID = nil
        lastError = nil
        switch source {
        case .fullTrack(let storeID):
            isPreview = false
            player.setQueue(with: [storeID])
            player.prepareToPlay { [weak self] error in
                Task { @MainActor [weak self] in
                    if error != nil {
                        self?.lastError = "这首歌暂时无法播放，检查 Apple Music 订阅或网络。"
                    }
                }
            }
        case .preview(let url):
            isPreview = true
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            previewPlayer = AVPlayer(playerItem: AVPlayerItem(url: url))
        }
    }

    func play() {
        if isPreview {
            try? AVAudioSession.sharedInstance().setActive(true)
            previewPlayer?.play()
        } else {
            player.play()
        }
        startTicker()
    }

    func pause() {
        if isPreview {
            previewPlayer?.pause()
        } else {
            player.pause()
        }
        stopTicker()
        refreshPlaybackState()
        tickTime()
    }

    func togglePlayPause() {
        isPlaying ? pause() : play()
    }

    func seek(to time: Double) {
        let clamped = max(0, min(time, max(0, duration - 0.1)))
        if isPreview {
            previewPlayer?.seek(
                to: CMTime(seconds: clamped, preferredTimescale: 600),
                toleranceBefore: .zero, toleranceAfter: .zero)
        } else {
            player.currentPlaybackTime = clamped
        }
        // 与本地播放器同语义：拖出循环句时迁移/解除单句循环
        if let loopRange, !loopRange.contains(clamped), let song {
            loopingLineID = LyricTimeline.index(at: clamped, lines: song.lines)
                .map { song.lines[$0].id }
        }
        currentTime = clamped
        refreshLineIndex()
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
        previewPlayer?.pause()
        previewPlayer = nil
        stopTicker()
        song = nil
        currentLineIndex = nil
        loopingLineID = nil
        isPlaying = false
        isPreview = false
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
            if isPreview {
                previewPlayer?.seek(
                    to: CMTime(seconds: loopRange.lowerBound, preferredTimescale: 600),
                    toleranceBefore: .zero, toleranceAfter: .zero)
            } else {
                player.currentPlaybackTime = loopRange.lowerBound
            }
            currentTime = loopRange.lowerBound
            refreshLineIndex()
        }
    }

    private func tickTime() {
        currentTime = isPreview
            ? (previewPlayer?.currentTime().seconds ?? 0)
            : player.currentPlaybackTime
        refreshLineIndex()
    }

    private func refreshPlaybackState() {
        isPlaying = isPreview
            ? previewPlayer?.timeControlStatus == .playing
            : player.playbackState == .playing
        // prepareToPlay 对 store id 队列常先报错随后照常播——播起来了就清掉误报
        if isPlaying, lastError != nil { lastError = nil }
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
