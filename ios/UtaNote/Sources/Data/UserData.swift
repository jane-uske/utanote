import Foundation
import SwiftData

// MARK: - SwiftData 模型（用户数据；歌曲内容本身是只读 bundle 资源）

/// 收藏的歌词行（歌词本条目）
@Model
final class SavedLine {
    var songID: String
    var lineID: String
    var note: String
    var createdAt: Date

    init(songID: String, lineID: String, note: String = "", createdAt: Date = .now) {
        self.songID = songID
        self.lineID = lineID
        self.note = note
        self.createdAt = createdAt
    }
}

/// 复习卡（Leitner 盒式间隔复习）
@Model
final class ReviewCard {
    var songID: String
    var lineID: String
    var box: Int
    var dueAt: Date
    var lastReviewedAt: Date?
    var timesReviewed: Int
    var lapses: Int
    var sourceRaw: String
    var createdAt: Date

    init(songID: String, lineID: String, source: Source, now: Date = .now) {
        self.songID = songID
        self.lineID = lineID
        self.box = 0
        self.dueAt = now
        self.lastReviewedAt = nil
        self.timesReviewed = 0
        self.lapses = 0
        self.sourceRaw = source.rawValue
        self.createdAt = now
    }

    enum Source: String {
        case saved      // 收藏时加入
        case lowScore   // 跟读分数不佳自动加入
        case manual     // 手动加入
    }

    var source: Source { Source(rawValue: sourceRaw) ?? .manual }
}

/// 跟读记录
@Model
final class PracticeRecord {
    var songID: String
    var lineID: String
    var score: Int
    var transcript: String?
    var createdAt: Date

    init(songID: String, lineID: String, score: Int, transcript: String?, createdAt: Date = .now) {
        self.songID = songID
        self.lineID = lineID
        self.score = score
        self.transcript = transcript
        self.createdAt = createdAt
    }
}

/// 每首歌的学习进度
@Model
final class SongProgress {
    var songID: String
    var lastLineID: String?
    var studiedLineIDs: [String]
    var updatedAt: Date

    init(songID: String) {
        self.songID = songID
        self.lastLineID = nil
        self.studiedLineIDs = []
        self.updatedAt = .now
    }
}

// MARK: - 复习调度（纯函数，可测）

enum ReviewGrade: Int, CaseIterable {
    case again = 0
    case good
    case easy

    var label: String {
        switch self {
        case .again: "忘了"
        case .good: "想起来了"
        case .easy: "很熟"
        }
    }
}

enum ReviewScheduler {
    /// 盒号 → 间隔天数
    static let intervalsDays: [Double] = [0, 1, 3, 7, 14, 30]

    static func apply(grade: ReviewGrade, toBox box: Int, now: Date) -> (box: Int, dueAt: Date) {
        switch grade {
        case .again:
            return (0, now.addingTimeInterval(10 * 60))
        case .good:
            let next = min(box + 1, intervalsDays.count - 1)
            return (next, due(next, now))
        case .easy:
            let next = min(box + 2, intervalsDays.count - 1)
            return (next, due(next, now))
        }
    }

    private static func due(_ box: Int, _ now: Date) -> Date {
        now.addingTimeInterval(intervalsDays[box] * 86400)
    }
}

// MARK: - 数据访问

@MainActor
enum UserDataStore {
    // 收藏

    static func savedLine(songID: String, lineID: String, in context: ModelContext) -> SavedLine? {
        var descriptor = FetchDescriptor<SavedLine>(
            predicate: #Predicate { $0.songID == songID && $0.lineID == lineID })
        descriptor.fetchLimit = 1
        return try? context.fetch(descriptor).first
    }

    static func isSaved(songID: String, lineID: String, in context: ModelContext) -> Bool {
        savedLine(songID: songID, lineID: lineID, in: context) != nil
    }

    /// 返回操作后的收藏状态
    @discardableResult
    static func toggleSaved(song: Song, line: LyricLine, in context: ModelContext) -> Bool {
        if let existing = savedLine(songID: song.id, lineID: line.id, in: context) {
            context.delete(existing)
            return false
        }
        context.insert(SavedLine(songID: song.id, lineID: line.id))
        ensureReviewCard(songID: song.id, lineID: line.id, source: .saved, in: context)
        return true
    }

    // 复习卡

    static func reviewCard(songID: String, lineID: String, in context: ModelContext) -> ReviewCard? {
        var descriptor = FetchDescriptor<ReviewCard>(
            predicate: #Predicate { $0.songID == songID && $0.lineID == lineID })
        descriptor.fetchLimit = 1
        return try? context.fetch(descriptor).first
    }

    static func ensureReviewCard(songID: String, lineID: String, source: ReviewCard.Source, in context: ModelContext) {
        guard reviewCard(songID: songID, lineID: lineID, in: context) == nil else { return }
        context.insert(ReviewCard(songID: songID, lineID: lineID, source: source))
    }

    static func removeReviewCard(songID: String, lineID: String, in context: ModelContext) {
        if let card = reviewCard(songID: songID, lineID: lineID, in: context) {
            context.delete(card)
        }
    }

    static func dueCards(now: Date = .now, in context: ModelContext) -> [ReviewCard] {
        let descriptor = FetchDescriptor<ReviewCard>(
            predicate: #Predicate { $0.dueAt <= now },
            sortBy: [SortDescriptor(\.dueAt)])
        return (try? context.fetch(descriptor)) ?? []
    }

    static func grade(_ card: ReviewCard, grade: ReviewGrade, now: Date = .now) {
        let result = ReviewScheduler.apply(grade: grade, toBox: card.box, now: now)
        card.box = result.box
        card.dueAt = result.dueAt
        card.lastReviewedAt = now
        card.timesReviewed += 1
        if grade == .again { card.lapses += 1 }
    }

    // 跟读

    static func recordPractice(song: Song, line: LyricLine, feedback: PronunciationFeedback, in context: ModelContext) {
        context.insert(
            PracticeRecord(songID: song.id, lineID: line.id, score: feedback.score, transcript: feedback.recognizedText))
        if feedback.score < 70 {
            ensureReviewCard(songID: song.id, lineID: line.id, source: .lowScore, in: context)
        }
    }

    // 进度

    static func progress(songID: String, in context: ModelContext) -> SongProgress? {
        var descriptor = FetchDescriptor<SongProgress>(
            predicate: #Predicate { $0.songID == songID })
        descriptor.fetchLimit = 1
        return try? context.fetch(descriptor).first
    }

    static func markStudied(song: Song, line: LyricLine, in context: ModelContext) {
        let progress = progress(songID: song.id, in: context) ?? {
            let created = SongProgress(songID: song.id)
            context.insert(created)
            return created
        }()
        progress.lastLineID = line.id
        if !progress.studiedLineIDs.contains(line.id) {
            progress.studiedLineIDs.append(line.id)
        }
        progress.updatedAt = .now
    }
}
