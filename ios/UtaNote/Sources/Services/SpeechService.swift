import AVFoundation
import Observation

/// 标准发音朗读（设备端日语 TTS）。
/// 之后可替换为服务端 TTS：保持 toggle/stop/activeUtteranceKey 语义即可。
@MainActor
@Observable
final class SpeechService: NSObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    private(set) var isSpeaking = false
    /// 正在朗读的按钮标识（key + 可选 "#slow" 后缀），供 UI 高亮
    private(set) var activeUtteranceKey: String?
    /// 开口朗读前回调；AppModel 用它暂停歌曲，保证任何入口的 TTS 都不与歌叠音
    var onWillSpeak: (() -> Void)?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// 再次点按同一个来源则停止
    func toggle(_ text: String, slow: Bool = false, key: String) {
        let utteranceKey = key + (slow ? "#slow" : "")
        if isSpeaking, activeUtteranceKey == utteranceKey {
            stop()
            return
        }
        stop()
        onWillSpeak?()
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.japaneseVoice
        utterance.rate = slow ? 0.3 : 0.48
        utterance.pitchMultiplier = 1.02
        utterance.preUtteranceDelay = 0.05
        synthesizer.speak(utterance)
        isSpeaking = true
        activeUtteranceKey = utteranceKey
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
        activeUtteranceKey = nil
    }

    static let japaneseVoice: AVSpeechSynthesisVoice? = {
        let voices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language == "ja-JP" }
        return voices.first { $0.quality == .premium }
            ?? voices.first { $0.quality == .enhanced }
            ?? AVSpeechSynthesisVoice(language: "ja-JP")
    }()

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        finishIfIdle(synthesizer)
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        finishIfIdle(synthesizer)
    }

    /// stop() 后立刻开新朗读时，didCancel 不应清掉新状态。
    /// isSpeaking 必须在主线程任务里读：回调时刻的快照可能早于新 utterance 入队。
    private nonisolated func finishIfIdle(_ synthesizer: AVSpeechSynthesizer) {
        Task { @MainActor in
            guard !self.synthesizer.isSpeaking else { return }
            self.isSpeaking = false
            self.activeUtteranceKey = nil
        }
    }
}
