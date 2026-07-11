import XCTest

@testable import UtaNote

final class LyricTimelineTests: XCTestCase {
    private func makeLine(_ id: String, _ start: Double, _ end: Double) -> LyricLine {
        LyricLine(
            id: id, start: start, end: end, text: "テスト", tokens: [],
            translation: "", words: [], grammar: [],
            emotion: EmotionTag(kind: .quiet, intensity: 0.5, note: ""),
            culture: nil, singingTip: nil)
    }

    private var lines: [LyricLine] {
        [
            makeLine("l1", 10, 14),
            makeLine("l2", 15, 19),
            makeLine("l3", 21, 26),
        ]
    }

    func testBeforeFirstLineIsNil() {
        XCTAssertNil(LyricTimeline.index(at: 0, lines: lines))
        XCTAssertNil(LyricTimeline.index(at: 9.99, lines: lines))
    }

    func testExactStartsAndMidline() {
        XCTAssertEqual(LyricTimeline.index(at: 10, lines: lines), 0)
        XCTAssertEqual(LyricTimeline.index(at: 12.5, lines: lines), 0)
        XCTAssertEqual(LyricTimeline.index(at: 15, lines: lines), 1)
        XCTAssertEqual(LyricTimeline.index(at: 22, lines: lines), 2)
    }

    func testGapKeepsPreviousLine() {
        // 19–21 是行间空隙，应保持上一行高亮
        XCTAssertEqual(LyricTimeline.index(at: 20, lines: lines), 1)
        XCTAssertEqual(LyricTimeline.index(at: 14.5, lines: lines), 0)
    }

    func testAfterLastLineStaysOnLast() {
        XCTAssertEqual(LyricTimeline.index(at: 100, lines: lines), 2)
    }

    func testEmptyLines() {
        XCTAssertNil(LyricTimeline.index(at: 5, lines: []))
    }
}
