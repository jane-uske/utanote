import XCTest

@testable import UtaNote

final class ReviewSchedulerTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testGoodAdvancesOneBox() {
        let result = ReviewScheduler.apply(grade: .good, toBox: 0, now: now)
        XCTAssertEqual(result.box, 1)
        XCTAssertEqual(result.dueAt.timeIntervalSince(now), 86400, accuracy: 1)
    }

    func testEasySkipsOneBox() {
        let result = ReviewScheduler.apply(grade: .easy, toBox: 1, now: now)
        XCTAssertEqual(result.box, 3)
        XCTAssertEqual(result.dueAt.timeIntervalSince(now), 7 * 86400, accuracy: 1)
    }

    func testAgainResetsToBoxZeroSoon() {
        let result = ReviewScheduler.apply(grade: .again, toBox: 4, now: now)
        XCTAssertEqual(result.box, 0)
        XCTAssertEqual(result.dueAt.timeIntervalSince(now), 600, accuracy: 1)
    }

    func testBoxIsCappedAtLastInterval() {
        let maxBox = ReviewScheduler.intervalsDays.count - 1
        let good = ReviewScheduler.apply(grade: .good, toBox: maxBox, now: now)
        XCTAssertEqual(good.box, maxBox)
        let easy = ReviewScheduler.apply(grade: .easy, toBox: maxBox - 1, now: now)
        XCTAssertEqual(easy.box, maxBox)
    }
}
