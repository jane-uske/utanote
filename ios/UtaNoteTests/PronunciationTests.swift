import XCTest

@testable import UtaNote

final class PronunciationTests: XCTestCase {
    func testRomajiFromKana() {
        XCTAssertTrue(JapaneseTransliterator.romajiFromKana("こんにちは").hasPrefix("konnichi"))
        XCTAssertEqual(JapaneseTransliterator.romajiFromKana("カケラ"), "kakera")
        XCTAssertEqual(JapaneseTransliterator.romajiFromKana("、。！"), "")
    }

    func testRomajiFromJapaneseReadsKanji() {
        let romaji = JapaneseTransliterator.romajiFromJapanese("夜の窓")
        XCTAssertTrue(romaji.contains("yoru"), "汉字「夜」应转写出 yoru，实际: \(romaji)")
        XCTAssertTrue(romaji.contains("mado"), "汉字「窓」应转写出 mado，实际: \(romaji)")
    }

    func testSimilarityRatio() {
        XCTAssertEqual(TextSimilarity.ratio("kakera", "kakera"), 1.0, accuracy: 0.0001)
        XCTAssertEqual(TextSimilarity.ratio("", ""), 1.0, accuracy: 0.0001)
        XCTAssertGreaterThan(TextSimilarity.ratio("kakera", "kakeru"), 0.6)
        XCTAssertLessThan(TextSimilarity.ratio("kakera", "zzzzzz"), 0.2)
    }

    func testLCSFlags() {
        let flags = TextSimilarity.lcsMatchedFlags(target: Array("abc"), spoken: Array("abc"))
        XCTAssertEqual(flags, [true, true, true])
        let none = TextSimilarity.lcsMatchedFlags(target: Array("abc"), spoken: Array(""))
        XCTAssertEqual(none, [false, false, false])
    }

    func testFeedbackScoresPerfectReadingHigh() {
        let line = LyricLine(
            id: "t1", start: 0, end: 3, text: "夜の窓",
            tokens: [
                Token(surface: "夜", reading: "よる"),
                Token(surface: "の", reading: nil),
                Token(surface: "窓", reading: "まど"),
            ],
            translation: "", words: [], grammar: [],
            emotion: EmotionTag(kind: .quiet, intensity: 0.5, note: ""),
            culture: nil, singingTip: nil)
        let good = SpeechPronunciationEvaluator.feedback(line: line, recognized: "夜の窓")
        XCTAssertGreaterThanOrEqual(good.score, 85, "完全一致的朗读应拿高分")
        XCTAssertTrue(good.tokenResults.allSatisfy(\.matched))

        let bad = SpeechPronunciationEvaluator.feedback(line: line, recognized: "全然違う言葉です")
        XCTAssertLessThan(bad.score, good.score)
    }
}
