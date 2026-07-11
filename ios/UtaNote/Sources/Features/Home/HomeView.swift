import SwiftData
import SwiftUI

/// 今日页：问候、继续学习、今日小结、待复习、曲库入口、今日一句。
struct HomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \SongProgress.updatedAt, order: .reverse) private var progresses: [SongProgress]
    @Query private var savedLines: [SavedLine]
    @Query private var reviewCards: [ReviewCard]
    @Query private var practices: [PracticeRecord]
    @Query private var courseProgress: [CourseLessonProgress]
    @Query private var courseReviewCards: [CourseReviewCard]
    @State private var showsCourseRoute = LaunchRoute.current == .course

    var body: some View {
        NavigationStack {
            ZStack {
                PaperBackground()
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 26) {
                        header
                        courseHero
                        if let target = resumeTarget {
                            continueCard(target.song, lineID: target.lineID)
                        }
                        todayStrip
                        if dueCount > 0 {
                            reviewNudge
                        }
                        songsSection
                        if let daily = dailyLine {
                            dailyLineCard(daily.0, daily.1)
                        }
                        Color.clear.frame(height: 16)
                    }
                    .padding(.horizontal, 20)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showsCourseRoute) {
                CourseDashboardView()
            }
        }
    }

    // MARK: - 问候

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(dateLine)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(UtaColor.inkFaint)
                .kerning(1)
            Text(greeting)
                .font(.lyric(30, heavy: true))
                .foregroundStyle(UtaColor.ink)
            Text("今天学会一句，再去喜欢的歌里遇见它。")
                .font(.system(size: 13.5))
                .foregroundStyle(UtaColor.inkSoft)
        }
        .padding(.top, 16)
    }

    // MARK: - 今日课程

    private var completedCourseIDs: Set<String> {
        Set(courseProgress.filter { $0.completedAt != nil }.map(\.lessonID))
    }

    private var nextCourseLesson: CourseLesson? {
        CourseCatalog.lessons.first { !completedCourseIDs.contains($0.id) }
    }

    private var courseDueCount: Int {
        courseReviewCards.filter { $0.dueAt <= .now }.count
    }

    private var courseHero: some View {
        NavigationLink {
            CourseDashboardView()
        } label: {
            UtaCard(padding: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    ZStack(alignment: .bottomLeading) {
                        LinearGradient(
                            colors: [UtaColor.indigo.darkened(0.12), UtaColor.indigo],
                            startPoint: .topLeading, endPoint: .bottomTrailing)
                        Circle()
                            .fill(.white.opacity(0.08))
                            .frame(width: 150, height: 150)
                            .offset(x: 240, y: -38)
                        VStack(alignment: .leading, spacing: 8) {
                            Text(nextCourseLesson?.kicker ?? "最初の一か月")
                                .font(.lyric(11))
                                .foregroundStyle(.white.opacity(0.65))
                                .kerning(2)
                            Text(nextCourseLesson?.title ?? "首月课程已完成")
                                .font(.system(size: 24, weight: .bold))
                                .foregroundStyle(.white)
                            Text(nextCourseLesson?.promise ?? "你已经完成了从零开始的 24 课。")
                                .font(.system(size: 13))
                                .foregroundStyle(.white.opacity(0.78))
                                .lineLimit(2)
                            HStack(spacing: 7) {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 10))
                                Text(nextCourseLesson == nil ? "查看课程记录" : "开始今天的 \(nextCourseLesson!.durationMinutes) 分钟")
                                    .font(.system(size: 13, weight: .semibold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 13)
                            .frame(height: 34)
                            .background(Capsule().fill(.white.opacity(0.16)))
                        }
                        .padding(20)
                    }
                    .frame(height: 210)
                    HStack {
                        Label("已完成 \(completedCourseIDs.count)/24", systemImage: "checkmark.circle")
                        Spacer()
                        if courseDueCount > 0 {
                            Label("\(courseDueCount) 项待复习", systemImage: "clock")
                        } else {
                            Text("零基础 · 一年挑战 N2")
                        }
                    }
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(UtaColor.inkSoft)
                    .padding(.horizontal, 16)
                    .frame(height: 44)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.985))
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        switch hour {
        case 5..<11: return "おはよう。"
        case 11..<18: return "こんにちは。"
        default: return "こんばんは。"
        }
    }

    private var dateLine: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "M月d日 EEEE"
        return formatter.string(from: .now)
    }

    // MARK: - 继续学习

    private var resumeTarget: (song: Song, lineID: String?)? {
        guard let progress = progresses.first,
              let song = app.song(withID: progress.songID) else { return nil }
        return (song, progress.lastLineID)
    }

    private func continueCard(_ song: Song, lineID: String?) -> some View {
        Button {
            app.openPlayer(song, atLineID: lineID)
        } label: {
            UtaCard {
                HStack(spacing: 14) {
                    CoverArtView(style: song.coverStyle, cornerRadius: 10)
                        .frame(width: 56, height: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("继续上次")
                            .font(.system(size: 11))
                            .foregroundStyle(UtaColor.inkFaint)
                        Text(song.title)
                            .font(.lyric(16, heavy: true))
                            .foregroundStyle(UtaColor.ink)
                        if let lineID, let line = song.line(withID: lineID) {
                            Text(line.text)
                                .font(.system(size: 12))
                                .foregroundStyle(UtaColor.inkSoft)
                                .lineLimit(1)
                        }
                    }
                    Spacer()
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(UtaColor.indigo)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
    }

    // MARK: - 今日小结

    private var savedTodayCount: Int {
        savedLines.filter { Calendar.current.isDateInToday($0.createdAt) }.count
    }
    private var practiceTodayCount: Int {
        practices.filter { Calendar.current.isDateInToday($0.createdAt) }.count
    }
    private var courseTodayCount: Int {
        courseProgress.filter {
            guard let date = $0.completedAt else { return false }
            return Calendar.current.isDateInToday(date)
        }.count
    }
    private var dueCount: Int {
        let now = Date.now
        return reviewCards.filter { $0.dueAt <= now }.count
    }

    private var todayStrip: some View {
        UtaCard(padding: 0) {
            HStack(spacing: 0) {
                statColumn(value: courseTodayCount, unit: "课", label: "今日课程")
                Rectangle().fill(UtaColor.hairline).frame(width: 0.6, height: 40)
                statColumn(value: practiceTodayCount, unit: "次", label: "今日跟读")
                Rectangle().fill(UtaColor.hairline).frame(width: 0.6, height: 40)
                Button {
                    app.tab = .review
                } label: {
                    statColumn(value: dueCount, unit: "句", label: "待复习", highlight: dueCount > 0)
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 14)
        }
    }

    private func statColumn(value: Int, unit: String, label: String, highlight: Bool = false) -> some View {
        VStack(spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text("\(value)")
                    .font(.system(size: 22, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(highlight ? UtaColor.vermilion : UtaColor.ink)
                Text(unit)
                    .font(.system(size: 11))
                    .foregroundStyle(UtaColor.inkFaint)
            }
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(UtaColor.inkSoft)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - 复习提醒

    private var reviewNudge: some View {
        Button {
            app.tab = .review
        } label: {
            UtaCard(padding: 14) {
                HStack(spacing: 12) {
                    SealStamp(size: 26, character: "復")
                    Text("有 \(dueCount) 句歌词在等你复习")
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(UtaColor.ink)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(UtaColor.inkFaint)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
    }

    // MARK: - 歌曲

    private var songsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "歌曲", kicker: "うた")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 14) {
                    ForEach(app.songs) { song in
                        songCard(song)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private func songCard(_ song: Song) -> some View {
        Button {
            app.openPlayer(song)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                CoverArtView(style: song.coverStyle)
                    .frame(width: 128, height: 128)
                    .shadow(color: .black.opacity(0.10), radius: 8, y: 4)
                VStack(alignment: .leading, spacing: 2) {
                    Text(song.title)
                        .font(.lyric(14, heavy: true))
                        .foregroundStyle(UtaColor.ink)
                        .lineLimit(1)
                    HStack(spacing: 5) {
                        Text(song.artist)
                            .font(.system(size: 11))
                            .foregroundStyle(UtaColor.inkSoft)
                        Chip(text: song.level, color: UtaColor.indigo)
                    }
                }
            }
            .frame(width: 128)
        }
        .buttonStyle(PressableStyle(scale: 0.97))
    }

    // MARK: - 今日一句

    private var dailyLine: (Song, LyricLine)? {
        let all = app.songs.flatMap { song in song.lines.map { (song, $0) } }
        guard !all.isEmpty else { return nil }
        let dayOfYear = Calendar.current.ordinality(of: .day, in: .year, for: .now) ?? 1
        return all[dayOfYear % all.count]
    }

    private func dailyLineCard(_ song: Song, _ line: LyricLine) -> some View {
        Button {
            app.openPlayerForStudy(song, lineID: line.id)
        } label: {
            UtaCard {
                VStack(spacing: 12) {
                    Text("今日の一句")
                        .font(.lyric(11))
                        .foregroundStyle(UtaColor.inkFaint)
                        .kerning(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    RubyText(tokens: line.tokens, surfaceSize: 19, alignment: .center)
                        .frame(maxWidth: .infinity)
                    Text(line.translation)
                        .font(.system(size: 12.5))
                        .foregroundStyle(UtaColor.inkSoft)
                    Text("出自「\(song.title)」 · 点击学习这一句")
                        .font(.system(size: 10.5))
                        .foregroundStyle(UtaColor.inkFaint)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
    }
}
