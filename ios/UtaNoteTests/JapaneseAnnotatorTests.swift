import XCTest

@testable import UtaNote

final class JapaneseAnnotatorTests: XCTestCase {
    func testTokensReassembleToOriginalText() {
        let samples = [
            "夜の窓に手紙を書く",
            "目を閉じれば　星が灯るよ",
            "まっすぐ歩こう",
            "Hello 世界！",
            "",
        ]
        for text in samples {
            let joined = JapaneseAnnotator.tokens(for: text).map(\.surface).joined()
            XCTAssertEqual(joined, text, "tokens 拼接必须等于原文")
        }
    }

    func testKanjiTokensGetKanaReading() {
        let tokens = JapaneseAnnotator.tokens(for: "夜の窓")
        let kanjiTokens = tokens.filter { $0.surface.contains("夜") || $0.surface.contains("窓") }
        XCTAssertFalse(kanjiTokens.isEmpty)
        for token in kanjiTokens {
            let reading = token.reading ?? ""
            XCTAssertFalse(reading.isEmpty, "汉字 token「\(token.surface)」应有注音")
            XCTAssertTrue(
                reading.unicodeScalars.allSatisfy { (0x3040...0x309F).contains($0.value) },
                "注音应为平假名，实际:「\(reading)」")
        }
    }

    func testKanaOnlyTokensHaveNoReading() {
        let tokens = JapaneseAnnotator.tokens(for: "まっすぐあるく")
        XCTAssertTrue(tokens.allSatisfy { $0.reading == nil }, "纯假名不应有注音")
    }
}
