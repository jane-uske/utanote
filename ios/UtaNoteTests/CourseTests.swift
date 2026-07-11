import XCTest

@testable import UtaNote

final class CourseTests: XCTestCase {
    func testFoundationCourseHasFourCompleteWeeks() {
        XCTAssertEqual(CourseCatalog.lessons.count, 24)
        XCTAssertEqual(CourseCatalog.weeks.count, 4)
        XCTAssertTrue(CourseCatalog.weeks.allSatisfy { $0.lessons.count == 6 })
        XCTAssertEqual(CourseCatalog.lessons.map(\.sequence), Array(1...24))
        XCTAssertEqual(Set(CourseCatalog.lessons.map(\.id)).count, 24)
    }

    func testEveryLessonIsDeliverable() {
        for lesson in CourseCatalog.lessons {
            XCTAssertFalse(lesson.title.isEmpty)
            XCTAssertFalse(lesson.promise.isEmpty)
            XCTAssertFalse(lesson.canDo.isEmpty)
            XCTAssertFalse(lesson.phrases.isEmpty)
            XCTAssertFalse(lesson.kana.isEmpty)
            XCTAssertTrue(lesson.quiz.choices.indices.contains(lesson.quiz.correctIndex))
            XCTAssertFalse(lesson.livePrompt.isEmpty)
            XCTAssertGreaterThanOrEqual(lesson.durationMinutes, 10)
        }
    }

    func testWeeklyPerformanceCadence() {
        let performances = CourseCatalog.lessons.filter(\.isWeeklyPerformance)
        XCTAssertEqual(performances.map(\.sequence), [6, 12, 18, 24])
    }

    func testCoursePracticeLineMatchesPhrase() {
        for lesson in CourseCatalog.lessons {
            let phrase = lesson.primaryPhrase
            let line = phrase.practiceLine
            XCTAssertEqual(line.text, phrase.text)
            XCTAssertEqual(line.kanaReading, phrase.reading)
            XCTAssertEqual(line.tokens.map(\.surface).joined(), phrase.text)
        }
    }

    func testCourseReviewScheduling() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let good = CourseReviewScheduler.apply(grade: .good, toBox: 0, now: now)
        XCTAssertEqual(good.box, 1)
        XCTAssertEqual(good.dueAt.timeIntervalSince(now), 86_400, accuracy: 1)

        let again = CourseReviewScheduler.apply(grade: .again, toBox: 4, now: now)
        XCTAssertEqual(again.box, 0)
        XCTAssertEqual(again.dueAt.timeIntervalSince(now), 600, accuracy: 1)
    }
}

