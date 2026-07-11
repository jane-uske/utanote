import AVFoundation
import Foundation
import Speech

// MARK: - 结构化反馈（UI 只依赖这个结构，不依赖自由文本）

struct PronunciationFeedback: Equatable {
    enum Verdict {
        case excellent, good, keepGoing

        var label: String {
            switch self {
            case .excellent: "非常棒"
            case .good: "不错"
            case .keepGoing: "再试一次"
            }
        }
    }

    struct TokenResult: Equatable, Identifiable {
        let id: Int
        let surface: String
        let matched: Bool
    }

    let score: Int
    let recognizedText: String?
    let tokenResults: [TokenResult]
    let tips: [String]
    let isSimulated: Bool

    var verdict: Verdict {
        score >= 85 ? .excellent : score >= 65 ? .good : .keepGoing
    }
}

/// 发音评估协议：当前为设备端语音识别实现，之后可替换为服务端 AI 评估。
protocol PronunciationEvaluating {
    func evaluate(recording: URL, line: LyricLine) async -> PronunciationFeedback
}

// MARK: - 设备端实现（SFSpeechRecognizer 日语识别 → 罗马字对齐打分）

final class SpeechPronunciationEvaluator: PronunciationEvaluating {
    func evaluate(recording: URL, line: LyricLine) async -> PronunciationFeedback {
        let status = await Self.requestAuthorization()
        guard status == .authorized,
              let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ja-JP")),
              recognizer.isAvailable else {
            return SimulatedPronunciationEvaluator.feedback(recording: recording, line: line)
        }
        let request = SFSpeechURLRecognitionRequest(url: recording)
        request.shouldReportPartialResults = false
        let recognized: String? = await withCheckedContinuation { continuation in
            let oneShot = OneShotContinuation(continuation)
            let task = recognizer.recognitionTask(with: request) { result, error in
                if let result, result.isFinal {
                    oneShot.resume(result.bestTranscription.formattedString)
                } else if error != nil {
                    oneShot.resume(nil)
                }
            }
            // 识别服务偶发不回调时的超时兜底；闭包同时把 recognizer/task
            // 强持有到超时点，防止提前释放导致 continuation 永不 resume
            DispatchQueue.global().asyncAfter(deadline: .now() + 15) {
                _ = recognizer
                task.cancel()
                oneShot.resume(nil)
            }
        }
        guard let recognized, !recognized.isEmpty else {
            return SimulatedPronunciationEvaluator.feedback(recording: recording, line: line)
        }
        return Self.feedback(line: line, recognized: recognized)
    }

    /// 线程安全的一次性 resume：识别回调与超时兜底谁先到谁生效
    private final class OneShotContinuation: @unchecked Sendable {
        private let lock = NSLock()
        private var continuation: CheckedContinuation<String?, Never>?

        init(_ continuation: CheckedContinuation<String?, Never>) {
            self.continuation = continuation
        }

        func resume(_ value: String?) {
            lock.lock()
            let taken = continuation
            continuation = nil
            lock.unlock()
            taken?.resume(returning: value)
        }
    }

    static func requestAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
    }

    /// 纯函数打分：目标读音 vs 识别结果（都转罗马字）
    static func feedback(line: LyricLine, recognized: String) -> PronunciationFeedback {
        let tokenRomaji = line.tokens.map { token in
            JapaneseTransliterator.romajiFromKana(token.reading ?? token.surface)
        }
        let targetAll = tokenRomaji.joined()
        let spokenAll = JapaneseTransliterator.romajiFromJapanese(recognized)
        let similarity = TextSimilarity.ratio(targetAll, spokenAll)
        let score = score(fromSimilarity: similarity)

        let flags = TextSimilarity.lcsMatchedFlags(target: Array(targetAll), spoken: Array(spokenAll))
        var results: [PronunciationFeedback.TokenResult] = []
        var cursor = 0
        for (index, token) in line.tokens.enumerated() {
            let length = tokenRomaji[index].count
            guard length > 0 else { continue }
            let matchedCount = flags[cursor..<min(cursor + length, flags.count)].filter { $0 }.count
            results.append(
                .init(id: index, surface: token.surface,
                      matched: Double(matchedCount) / Double(length) >= 0.7))
            cursor += length
        }
        let tips = PronunciationTips.tips(for: line, tokenResults: results, score: score)
        return PronunciationFeedback(
            score: score, recognizedText: recognized,
            tokenResults: results, tips: tips, isSimulated: false)
    }

    static func score(fromSimilarity similarity: Double) -> Int {
        // 柔性曲线：0.9 的相似度已接近满分
        let curved = pow(max(0, min(1, similarity)), 0.7)
        return Int((curved * 100).rounded())
    }
}

// MARK: - 识别不可用时的演示反馈（确定性，UI 会标注「演示反馈」）

enum SimulatedPronunciationEvaluator {
    static func feedback(recording: URL, line: LyricLine) -> PronunciationFeedback {
        let duration = (try? AVAudioPlayer(contentsOf: recording))?.duration ?? 0
        let reading = line.kanaReading
        let moraCount = reading.filter { !"ゃゅょぁぃぅぇぉ 　、。！？…".contains($0) }.count
        let expected = Double(moraCount) * 0.16 + 0.4
        let closeness = duration <= 0.2
            ? 0.3
            : max(0, 1 - abs(duration - expected) / max(expected, 0.8))
        let seed = line.id.unicodeScalars.reduce(UInt64(5381)) { ($0 << 5) &+ $0 &+ UInt64($1.value) }
        let score = min(95, 60 + Int(closeness * 28) + Int(seed % 8))

        // 标记 1–2 个「难点」token（促音/拗音/长音优先），其余命中
        var hardIndices: [Int] = []
        for (index, token) in line.tokens.enumerated() {
            let kana = token.reading ?? token.surface
            if kana.contains("っ") || kana.contains("ー")
                || kana.contains(where: { "ゃゅょ".contains($0) }) {
                hardIndices.append(index)
            }
        }
        let missCount = score >= 85 ? 0 : min(hardIndices.count, score >= 70 ? 1 : 2)
        let missed = Set(hardIndices.prefix(missCount))
        var results: [PronunciationFeedback.TokenResult] = []
        for (index, token) in line.tokens.enumerated() {
            let romaji = JapaneseTransliterator.romajiFromKana(token.reading ?? token.surface)
            guard !romaji.isEmpty else { continue }
            results.append(.init(id: index, surface: token.surface, matched: !missed.contains(index)))
        }
        let tips = PronunciationTips.tips(for: line, tokenResults: results, score: score)
        return PronunciationFeedback(
            score: score, recognizedText: nil,
            tokenResults: results, tips: tips, isSimulated: true)
    }
}

// MARK: - 罗马字转写

enum JapaneseTransliterator {
    /// 假名（平/片）→ 罗马字；非假名字符被丢弃
    static func romajiFromKana(_ kana: String) -> String {
        let mutable = NSMutableString(string: kana)
        // 片假名先转平假名
        CFStringTransform(mutable, nil, kCFStringTransformHiraganaKatakana, true)
        CFStringTransform(mutable, nil, kCFStringTransformLatinHiragana, true)
        return normalize(mutable as String)
    }

    /// 含汉字日文 → 罗马字（词法分析取拉丁转写）
    static func romajiFromJapanese(_ text: String) -> String {
        let cfText = text as CFString
        let tokenizer = CFStringTokenizerCreate(
            kCFAllocatorDefault, cfText,
            CFRangeMake(0, CFStringGetLength(cfText)),
            kCFStringTokenizerUnitWordBoundary,
            Locale(identifier: "ja_JP") as CFLocale)
        var output = ""
        while CFStringTokenizerAdvanceToNextToken(tokenizer) != [] {
            if let latin = CFStringTokenizerCopyCurrentTokenAttribute(
                tokenizer, kCFStringTokenizerAttributeLatinTranscription) as? String {
                output += latin
            }
        }
        return normalize(output)
    }

    static func normalize(_ text: String) -> String {
        text.lowercased().filter { $0.isASCII && $0.isLetter }
    }
}

// MARK: - 相似度

enum TextSimilarity {
    static func levenshtein(_ a: [Character], _ b: [Character]) -> Int {
        if a.isEmpty { return b.count }
        if b.isEmpty { return a.count }
        var previous = Array(0...b.count)
        var current = [Int](repeating: 0, count: b.count + 1)
        for i in 1...a.count {
            current[0] = i
            for j in 1...b.count {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            }
            swap(&previous, &current)
        }
        return previous[b.count]
    }

    /// 0…1 相似度
    static func ratio(_ a: String, _ b: String) -> Double {
        let ca = Array(a)
        let cb = Array(b)
        if ca.isEmpty, cb.isEmpty { return 1 }
        let distance = levenshtein(ca, cb)
        return 1 - Double(distance) / Double(max(ca.count, cb.count, 1))
    }

    /// LCS：target 中每个字符是否被 spoken 匹配到
    static func lcsMatchedFlags(target: [Character], spoken: [Character]) -> [Bool] {
        let n = target.count
        let m = spoken.count
        guard n > 0 else { return [] }
        guard m > 0 else { return [Bool](repeating: false, count: n) }
        var dp = [[Int]](repeating: [Int](repeating: 0, count: m + 1), count: n + 1)
        for i in 1...n {
            for j in 1...m {
                dp[i][j] = target[i - 1] == spoken[j - 1]
                    ? dp[i - 1][j - 1] + 1
                    : max(dp[i - 1][j], dp[i][j - 1])
            }
        }
        var flags = [Bool](repeating: false, count: n)
        var i = n
        var j = m
        while i > 0, j > 0 {
            if target[i - 1] == spoken[j - 1] {
                flags[i - 1] = true
                i -= 1
                j -= 1
            } else if dp[i - 1][j] >= dp[i][j - 1] {
                i -= 1
            } else {
                j -= 1
            }
        }
        return flags
    }
}

// MARK: - 发音建议（规则化，中文）

enum PronunciationTips {
    static func tips(for line: LyricLine, tokenResults: [PronunciationFeedback.TokenResult], score: Int) -> [String] {
        var tips: [String] = []
        let reading = line.kanaReading
        if let miss = tokenResults.first(where: { !$0.matched }) {
            tips.append("「\(miss.surface)」这里读得不太清楚，单独慢读三遍试试。")
        }
        if reading.contains("っ") {
            tips.append("「っ」是促音：停顿半拍再发下一个音，不要念出声。")
        }
        if reading.contains(where: { "ゃゅょ".contains($0) }) {
            tips.append("拗音（ゃ・ゅ・ょ）要和前一个假名拼成一个音节，别拆开读。")
        }
        if reading.contains("ー") || hasLongVowel(reading) {
            tips.append("注意长音要拖满一拍，长短不同意思就变了。")
        }
        if reading.contains("ん") {
            tips.append("「ん」自己占一拍，轻轻带过反而不自然。")
        }
        if score < 60 {
            tips.append("先用慢速跟着标准发音整句读顺，再回到常速。")
        }
        return Array(tips.prefix(3))
    }

    static func hasLongVowel(_ kana: String) -> Bool {
        let pairs = [
            "おう", "こう", "そう", "とう", "のう", "ほう", "もう", "よう", "ろう",
            "ごう", "ぞう", "どう", "ぼう", "ぽう",
            "えい", "けい", "せい", "てい", "ねい", "へい", "めい", "れい", "げい", "ぜい",
            "ゅう", "うう", "ゆう",
        ]
        return pairs.contains { kana.contains($0) }
    }
}
