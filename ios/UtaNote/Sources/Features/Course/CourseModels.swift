import Foundation
import SwiftData

// MARK: - 课程内容

struct CoursePhrase: Identifiable, Hashable {
    let id: String
    let text: String
    let reading: String
    let translation: String
    let note: String

    var practiceLine: LyricLine {
        LyricLine(
            id: "course-\(id)", start: 0, end: 4, text: text,
            tokens: [Token(surface: text, reading: reading)],
            translation: translation, words: [], grammar: [],
            emotion: EmotionTag(kind: .hopeful, intensity: 0.5, note: "课程跟读"),
            culture: nil, singingTip: note)
    }
}

struct CourseQuiz: Hashable {
    let prompt: String
    let choices: [String]
    let correctIndex: Int
    let explanation: String
}

struct CourseLesson: Identifiable, Hashable {
    let id: String
    let sequence: Int
    let week: Int
    let day: Int
    let title: String
    let kicker: String
    let promise: String
    let canDo: String
    let durationMinutes: Int
    let kana: [String]
    let phrases: [CoursePhrase]
    let explanation: String
    let quiz: CourseQuiz
    let liveMission: String
    let tomorrowHook: String
    let isWeeklyPerformance: Bool

    var primaryPhrase: CoursePhrase { phrases[0] }
    var numberLabel: String { "第 \(sequence) 课" }

    var livePrompt: String {
        let phraseList = phrases.map { "\($0.text)（\($0.translation)）" }.joined(separator: "、")
        return """
        你是耐心的日语口语教练。学习者是中国母语的零基础用户，正在完成 UtaNote \(numberLabel)「\(title)」。

        本课目标：\(canDo)
        已学表达：\(phraseList)
        任务：\(liveMission)

        请遵守：
        1. 中文说明，日语练习；一次只问一个问题。
        2. 只使用本课表达，最多新增两个词。
        3. 每次日语不超过一个短句，回答后等待至少三秒。
        4. 我卡住时依次给关键词、句首、完整答案。
        5. 每轮最多纠正一个最影响理解的问题，先回应意思再纠正。
        6. 完成三轮后，用中文总结一个亮点、一个重点错误和三个复习句。

        现在先慢速示范，不要立刻连续提问。
        """
    }
}

struct CourseWeek: Identifiable, Hashable {
    let id: Int
    let title: String
    let subtitle: String
    let goal: String
    let lessons: [CourseLesson]
}

// MARK: - 用户课程数据

@Model
final class CourseProfile {
    @Attribute(.unique) var profileID: String
    var createdAt: Date
    var targetRaw: String
    var dailyMinutes: Int
    var interestsRaw: String

    init(
        profileID: String = "default",
        targetRaw: String = "一年挑战 N2",
        dailyMinutes: Int = 60,
        interests: [String] = ["音乐", "旅行"]
    ) {
        self.profileID = profileID
        self.createdAt = .now
        self.targetRaw = targetRaw
        self.dailyMinutes = dailyMinutes
        self.interestsRaw = interests.joined(separator: ",")
    }

    var interests: [String] {
        interestsRaw.split(separator: ",").map(String.init)
    }
}

@Model
final class CourseLessonProgress {
    @Attribute(.unique) var lessonID: String
    var startedAt: Date
    var completedAt: Date?
    var lastOpenedAt: Date
    var bestPronunciationScore: Int
    var quizPassed: Bool
    var livePracticeCompleted: Bool

    init(lessonID: String, now: Date = .now) {
        self.lessonID = lessonID
        self.startedAt = now
        self.completedAt = nil
        self.lastOpenedAt = now
        self.bestPronunciationScore = 0
        self.quizPassed = false
        self.livePracticeCompleted = false
    }
}

@Model
final class CourseSpeakingRecord {
    var lessonID: String
    var phraseID: String
    var score: Int
    var recognizedText: String?
    var isSimulated: Bool
    var createdAt: Date

    init(lessonID: String, phraseID: String, feedback: PronunciationFeedback, now: Date = .now) {
        self.lessonID = lessonID
        self.phraseID = phraseID
        self.score = feedback.score
        self.recognizedText = feedback.recognizedText
        self.isSimulated = feedback.isSimulated
        self.createdAt = now
    }
}

@Model
final class CourseReviewCard {
    @Attribute(.unique) var reviewID: String
    var lessonID: String
    var prompt: String
    var answer: String
    var reading: String
    var box: Int
    var dueAt: Date
    var lastReviewedAt: Date?
    var timesReviewed: Int
    var lapses: Int

    init(lessonID: String, phrase: CoursePhrase, now: Date = .now) {
        self.reviewID = "\(lessonID)::\(phrase.id)"
        self.lessonID = lessonID
        self.prompt = phrase.translation
        self.answer = phrase.text
        self.reading = phrase.reading
        self.box = 0
        self.dueAt = now
        self.lastReviewedAt = nil
        self.timesReviewed = 0
        self.lapses = 0
    }
}

enum CourseReviewGrade: Int, CaseIterable {
    case again, good, easy

    var label: String {
        switch self {
        case .again: "忘了"
        case .good: "想起来了"
        case .easy: "很熟"
        }
    }
}

enum CourseReviewScheduler {
    static let intervalsDays: [Double] = [0, 1, 3, 7, 14, 30, 60]

    static func apply(grade: CourseReviewGrade, toBox box: Int, now: Date) -> (box: Int, dueAt: Date) {
        switch grade {
        case .again:
            return (0, now.addingTimeInterval(10 * 60))
        case .good:
            let next = min(box + 1, intervalsDays.count - 1)
            return (next, now.addingTimeInterval(intervalsDays[next] * 86_400))
        case .easy:
            let next = min(box + 2, intervalsDays.count - 1)
            return (next, now.addingTimeInterval(intervalsDays[next] * 86_400))
        }
    }
}

// MARK: - 数据访问

@MainActor
enum CourseStore {
    static func profile(in context: ModelContext) -> CourseProfile? {
        var descriptor = FetchDescriptor<CourseProfile>()
        descriptor.fetchLimit = 1
        return try? context.fetch(descriptor).first
    }

    static func progress(for lessonID: String, in context: ModelContext) -> CourseLessonProgress? {
        var descriptor = FetchDescriptor<CourseLessonProgress>(
            predicate: #Predicate { $0.lessonID == lessonID })
        descriptor.fetchLimit = 1
        return try? context.fetch(descriptor).first
    }

    @discardableResult
    static func start(_ lesson: CourseLesson, in context: ModelContext) -> CourseLessonProgress {
        if let existing = progress(for: lesson.id, in: context) {
            existing.lastOpenedAt = .now
            return existing
        }
        let created = CourseLessonProgress(lessonID: lesson.id)
        context.insert(created)
        return created
    }

    static func record(feedback: PronunciationFeedback, lesson: CourseLesson, in context: ModelContext) {
        let progress = start(lesson, in: context)
        progress.bestPronunciationScore = max(progress.bestPronunciationScore, feedback.score)
        context.insert(CourseSpeakingRecord(
            lessonID: lesson.id, phraseID: lesson.primaryPhrase.id, feedback: feedback))
    }

    static func complete(_ lesson: CourseLesson, quizPassed: Bool, liveCompleted: Bool, in context: ModelContext) {
        let progress = start(lesson, in: context)
        progress.quizPassed = progress.quizPassed || quizPassed
        progress.livePracticeCompleted = progress.livePracticeCompleted || liveCompleted
        progress.completedAt = progress.completedAt ?? .now
        for phrase in lesson.phrases.prefix(3) {
            ensureReviewCard(lesson: lesson, phrase: phrase, in: context)
        }
        try? context.save()
    }

    static func ensureReviewCard(
        lesson: CourseLesson, phrase: CoursePhrase, in context: ModelContext
    ) {
        let reviewID = "\(lesson.id)::\(phrase.id)"
        var descriptor = FetchDescriptor<CourseReviewCard>(
            predicate: #Predicate { $0.reviewID == reviewID })
        descriptor.fetchLimit = 1
        guard (try? context.fetch(descriptor).first) == nil else { return }
        context.insert(CourseReviewCard(lessonID: lesson.id, phrase: phrase))
    }

    static func grade(_ card: CourseReviewCard, grade: CourseReviewGrade, now: Date = .now) {
        let result = CourseReviewScheduler.apply(grade: grade, toBox: card.box, now: now)
        card.box = result.box
        card.dueAt = result.dueAt
        card.lastReviewedAt = now
        card.timesReviewed += 1
        if grade == .again { card.lapses += 1 }
    }
}

