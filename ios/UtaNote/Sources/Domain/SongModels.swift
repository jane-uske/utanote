import SwiftUI

// MARK: - 歌曲内容模型（与 Resources/Songs/*.json 对应，schema 见 scripts/ios/SONG_SCHEMA.md）

struct Song: Codable, Identifiable, Hashable {
    let id: String
    let order: Int
    let title: String
    let titleReading: String
    let titleTranslation: String
    let artist: String
    let level: String
    let summary: String
    let storyIntro: String
    let tags: [String]
    let coverStyle: CoverStyle
    let durationSec: Double
    let lines: [LyricLine]

    var accentColor: Color { Color(hex: coverStyle.accentHex) }

    func line(withID id: String) -> LyricLine? {
        lines.first { $0.id == id }
    }

    func lineIndex(withID id: String) -> Int? {
        lines.firstIndex { $0.id == id }
    }
}

struct CoverStyle: Codable, Hashable {
    let glyph: String
    let colors: [String]
    let accentHex: String

    var swiftColors: [Color] { colors.map { Color(hex: $0) } }
}

struct LyricLine: Codable, Identifiable, Hashable {
    let id: String
    let start: Double
    let end: Double
    let text: String
    let tokens: [Token]
    let translation: String
    let words: [WordEntry]
    let grammar: [GrammarPoint]
    let emotion: EmotionTag
    let culture: String?
    let singingTip: String?

    var duration: Double { end - start }
    /// 整句假名读音（无读音的 token 用原文，标点原样保留）
    var kanaReading: String {
        tokens.map { $0.reading ?? $0.surface }.joined()
    }
}

struct Token: Codable, Hashable {
    let surface: String
    let reading: String?
}

struct WordEntry: Codable, Hashable, Identifiable {
    var id: String { surface + meaning }
    let surface: String
    let reading: String
    let meaning: String
    let level: String
    let note: String?
}

struct GrammarPoint: Codable, Hashable, Identifiable {
    var id: String { pattern }
    let pattern: String
    let explanation: String
    let example: String
    let exampleTranslation: String
}

struct EmotionTag: Codable, Hashable {
    let kind: EmotionKind
    let intensity: Double
    let note: String
}

enum EmotionKind: String, Codable, CaseIterable {
    case warm, nostalgic, hopeful, melancholic, tender, longing, bright, bittersweet, quiet, resolute

    var label: String {
        switch self {
        case .warm: "温暖"
        case .nostalgic: "怀念"
        case .hopeful: "期盼"
        case .melancholic: "忧郁"
        case .tender: "温柔"
        case .longing: "思念"
        case .bright: "明亮"
        case .bittersweet: "苦甜"
        case .quiet: "安静"
        case .resolute: "坚定"
        }
    }

    var color: Color {
        switch self {
        case .warm: Color(hex: "#B8804C")
        case .nostalgic: Color(hex: "#8A7355")
        case .hopeful: Color(hex: "#5E8C6A")
        case .melancholic: Color(hex: "#5C6B8A")
        case .tender: Color(hex: "#B06A76")
        case .longing: Color(hex: "#7A6A9E")
        case .bright: Color(hex: "#C09A3E")
        case .bittersweet: Color(hex: "#A2685A")
        case .quiet: Color(hex: "#6E7D74")
        case .resolute: Color(hex: "#46587A")
        }
    }
}

// MARK: - 时间轴

enum LyricTimeline {
    /// 时间 t 应高亮的行：最后一个 start <= t 的行；t 在首行之前返回 nil。
    /// 行间空隙保持上一行高亮，直到下一行开始。
    static func index(at t: Double, lines: [LyricLine]) -> Int? {
        guard let first = lines.first, t >= first.start else { return nil }
        var lo = 0
        var hi = lines.count - 1
        while lo < hi {
            let mid = (lo + hi + 1) / 2
            if lines[mid].start <= t { lo = mid } else { hi = mid - 1 }
        }
        return lo
    }
}
