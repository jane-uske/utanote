import AVFoundation
import Observation

/// 跟读录音：权限、录制、电平表、回放。
@MainActor
@Observable
final class RecordingController: NSObject, AVAudioRecorderDelegate, AVAudioPlayerDelegate {
    enum Phase: Equatable {
        case idle, denied, recording, recorded, playingBack
    }

    private(set) var phase: Phase = .idle
    private(set) var elapsed: Double = 0
    /// 0…1 电平序列，驱动波形
    private(set) var levelHistory: [Float] = []
    private(set) var recordingURL: URL?
    private(set) var recordingDuration: Double = 0

    private var recorder: AVAudioRecorder?
    private var playbackPlayer: AVAudioPlayer?
    private var meterTimer: Timer?
    private var isStarting = false

    override init() {
        super.init()
        // 来电等中断时结束录音/回放，避免 phase 卡死、会话悬置
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] note in
            guard let info = note.userInfo,
                  let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: typeValue) == .began else { return }
            Task { @MainActor [weak self] in
                guard let self else { return }
                switch self.phase {
                case .recording: self.stopRecording()
                case .playingBack: self.stopPlayback()
                default: break
                }
            }
        }
    }

    func start() async {
        // 权限 await 期间可能被再次点按，双重守卫防止泄漏 recorder/Timer
        guard phase != .recording, !isStarting else { return }
        isStarting = true
        defer { isStarting = false }
        guard await AVAudioApplication.requestRecordPermission() else {
            phase = .denied
            return
        }
        guard phase != .recording else { return }
        stopPlayback()
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("uta-practice-\(UUID().uuidString).m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44100.0,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ]
            let newRecorder = try AVAudioRecorder(url: url, settings: settings)
            newRecorder.isMeteringEnabled = true
            newRecorder.delegate = self
            guard newRecorder.record() else {
                phase = .idle
                return
            }
            recorder = newRecorder
            recordingURL = url
            levelHistory = []
            elapsed = 0
            phase = .recording
            startMeter()
        } catch {
            phase = .idle
        }
    }

    func stopRecording() {
        guard phase == .recording else { return }
        stopMeter()
        recordingDuration = recorder?.currentTime ?? 0
        recorder?.stop()
        recorder = nil
        phase = .recorded
        // 交还播放类目，让 TTS / 歌曲继续可用
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
    }

    func playBack() {
        guard let url = recordingURL,
              let player = try? AVAudioPlayer(contentsOf: url) else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        player.delegate = self
        player.play()
        playbackPlayer = player
        phase = .playingBack
    }

    func stopPlayback() {
        playbackPlayer?.stop()
        playbackPlayer = nil
        if phase == .playingBack { phase = .recorded }
    }

    func reset() {
        // 录音中直接退出页面也要走 stopRecording()，交还 .playback 类目
        if phase == .recording { stopRecording() }
        stopMeter()
        recorder?.stop()
        recorder = nil
        stopPlayback()
        if let url = recordingURL {
            try? FileManager.default.removeItem(at: url)
        }
        recordingURL = nil
        levelHistory = []
        elapsed = 0
        recordingDuration = 0
        phase = .idle
    }

    private func startMeter() {
        stopMeter()
        let timer = Timer(timeInterval: 0.05, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.meterTick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        meterTimer = timer
    }

    private func stopMeter() {
        meterTimer?.invalidate()
        meterTimer = nil
    }

    private func meterTick() {
        guard let recorder, phase == .recording else { return }
        recorder.updateMeters()
        let db = recorder.averagePower(forChannel: 0)  // -160…0
        let level = max(0, min(1, (db + 50) / 50))
        levelHistory.append(level)
        if levelHistory.count > 120 {
            levelHistory.removeFirst(levelHistory.count - 120)
        }
        elapsed = recorder.currentTime
        // 单句跟读的合理上限
        if elapsed > 20 { stopRecording() }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            if self.phase == .playingBack { self.phase = .recorded }
        }
    }
}
