import AVFoundation
import MediaPlayer
import Observation
import SwiftUI

/// 歌曲播放：AVAudioPlayer + 歌词时间轴 + 后台播放 + 锁屏/耳机控制。
@MainActor
@Observable
final class AudioPlayerController: NSObject, AVAudioPlayerDelegate {
    private(set) var song: Song?
    private(set) var isPlaying = false
    private(set) var currentTime: Double = 0
    private(set) var currentLineIndex: Int?
    private(set) var hasAudio = false

    var playbackRate: Double = 1.0 {
        didSet {
            player?.rate = Float(playbackRate)
            updateNowPlaying()
        }
    }

    /// 单句循环的行 id
    var loopingLineID: String? {
        didSet { applyLoopRange() }
    }

    private var player: AVAudioPlayer?
    private var ticker: Timer?
    private var loopRange: ClosedRange<Double>?
    private var artwork: MPMediaItemArtwork?
    private var remoteCommandsConfigured = false

    var duration: Double { song?.durationSec ?? player?.duration ?? 0 }

    override init() {
        super.init()
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] note in
            guard let info = note.userInfo,
                  let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
            let optionsValue = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let shouldResume = AVAudioSession.InterruptionOptions(rawValue: optionsValue).contains(.shouldResume)
            Task { @MainActor [weak self] in
                self?.handleInterruption(type: type, shouldResume: shouldResume)
            }
        }
    }

    // MARK: - 加载与播放

    func load(_ song: Song, autoplay: Bool = true) {
        if self.song?.id == song.id {
            if autoplay, !isPlaying { play() }
            return
        }
        stopTicker()
        player?.stop()
        self.song = song
        currentTime = 0
        currentLineIndex = nil
        loopingLineID = nil
        hasAudio = false
        if let url = SongLibrary.audioURL(for: song),
           let newPlayer = try? AVAudioPlayer(contentsOf: url) {
            newPlayer.enableRate = true
            newPlayer.delegate = self
            newPlayer.prepareToPlay()
            player = newPlayer
            hasAudio = true
        } else {
            player = nil
        }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        configureRemoteCommandsIfNeeded()
        artwork = Self.makeArtwork(for: song)
        updateNowPlaying()
        if autoplay { play() }
    }

    func play() {
        guard let player else { return }
        try? AVAudioSession.sharedInstance().setActive(true)
        player.play()
        player.rate = Float(playbackRate)
        isPlaying = true
        startTicker()
        updateNowPlaying()
    }

    func pause() {
        player?.pause()
        isPlaying = false
        stopTicker()
        syncTime()
        updateNowPlaying()
    }

    func togglePlayPause() {
        isPlaying ? pause() : play()
    }

    func seek(to time: Double) {
        guard let player else { return }
        let clamped = max(0, min(time, player.duration - 0.05))
        player.currentTime = clamped
        // 拖出循环句范围时把单句循环迁到落点所在行（间奏则解除），否则会被 tick 拉回原句
        if let loopRange, !loopRange.contains(clamped), let song {
            loopingLineID = LyricTimeline.index(at: clamped, lines: song.lines)
                .map { song.lines[$0].id }
        }
        syncTime()
        updateNowPlaying()
    }

    func seek(toLine index: Int) {
        guard let song, song.lines.indices.contains(index) else { return }
        seek(to: song.lines[index].start)
    }

    /// 上一句/下一句
    func stepLine(_ delta: Int) {
        guard let song else { return }
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

    private func applyLoopRange() {
        guard let song, let id = loopingLineID, let line = song.line(withID: id) else {
            loopRange = nil
            return
        }
        loopRange = line.start...line.end
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
        guard let player else { return }
        currentTime = player.currentTime
        if let loopRange, currentTime >= loopRange.upperBound - 0.03 {
            player.currentTime = loopRange.lowerBound
            currentTime = loopRange.lowerBound
        }
        refreshLineIndex()
    }

    private func syncTime() {
        currentTime = player?.currentTime ?? 0
        refreshLineIndex()
    }

    private func refreshLineIndex() {
        guard let song else { return }
        let index = LyricTimeline.index(at: currentTime, lines: song.lines)
        if index != currentLineIndex {
            currentLineIndex = index
        }
    }

    // MARK: - 中断与结束

    private func handleInterruption(type: AVAudioSession.InterruptionType, shouldResume: Bool) {
        switch type {
        case .began:
            if isPlaying { pause() }
        case .ended:
            if shouldResume { play() }
        @unknown default:
            break
        }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.handlePlaybackFinished() }
    }

    private func handlePlaybackFinished() {
        isPlaying = false
        stopTicker()
        currentTime = duration
        refreshLineIndex()
        updateNowPlaying()
    }

    // MARK: - 锁屏与耳机控制

    private func configureRemoteCommandsIfNeeded() {
        guard !remoteCommandsConfigured else { return }
        remoteCommandsConfigured = true
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.play() }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.pause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.togglePlayPause() }
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.stepLine(1) }
            return .success
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.stepLine(-1) }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let positionEvent = event as? MPChangePlaybackPositionCommandEvent else {
                return .commandFailed
            }
            let position = positionEvent.positionTime
            Task { @MainActor in self?.seek(to: position) }
            return .success
        }
    }

    private func updateNowPlaying() {
        guard let song else {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            return
        }
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: song.title,
            MPMediaItemPropertyArtist: song.artist,
            MPMediaItemPropertyAlbumTitle: "UtaNote",
            MPMediaItemPropertyPlaybackDuration: player?.duration ?? song.durationSec,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? playbackRate : 0,
        ]
        if let artwork {
            info[MPMediaItemPropertyArtwork] = artwork
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private static func makeArtwork(for song: Song) -> MPMediaItemArtwork? {
        let renderer = ImageRenderer(
            content: CoverArtView(style: song.coverStyle, cornerRadius: 0)
                .frame(width: 600, height: 600))
        renderer.scale = 1
        guard let image = renderer.uiImage else { return nil }
        return MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    }
}
