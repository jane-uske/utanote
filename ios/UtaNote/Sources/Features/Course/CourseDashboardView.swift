import SwiftData
import SwiftUI

struct CourseDashboardView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \CourseLessonProgress.startedAt) private var progress: [CourseLessonProgress]
    @Query private var profiles: [CourseProfile]
    @Query(sort: \CourseReviewCard.dueAt) private var reviewCards: [CourseReviewCard]

    private var completedIDs: Set<String> {
        Set(progress.filter { $0.completedAt != nil }.map(\.lessonID))
    }

    private var nextLesson: CourseLesson? {
        CourseCatalog.lessons.first { !completedIDs.contains($0.id) }
    }

    private var dueCount: Int {
        reviewCards.filter { $0.dueAt <= .now }.count
    }

    var body: some View {
        ZStack {
            PaperBackground(tint: UtaColor.indigo)
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 24) {
                    header
                    progressHero
                    if dueCount > 0 { reviewCallout }
                    ForEach(CourseCatalog.weeks) { week in
                        weekSection(week)
                    }
                    betaRoadmap
                    Color.clear.frame(height: 24)
                }
                .padding(.horizontal, 20)
            }
        }
        .navigationTitle("课程")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: CourseLesson.self) { lesson in
            CourseLessonView(lesson: lesson)
        }
        .sheet(isPresented: setupBinding) {
            CourseSetupView()
                .interactiveDismissDisabled()
        }
    }

    private var setupBinding: Binding<Bool> {
        Binding(get: { profiles.isEmpty }, set: { _ in })
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("はじめの一か月")
                .font(.lyric(11))
                .foregroundStyle(UtaColor.inkFaint)
                .kerning(2)
            Text("零基础开口课")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(UtaColor.ink)
            Text("24 节完整课程 · 每周 6 天 · 从第一句到 90 秒会话")
                .font(.system(size: 13))
                .foregroundStyle(UtaColor.inkSoft)
        }
        .padding(.top, 12)
    }

    private var progressHero: some View {
        UtaCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .firstTextBaseline) {
                    Text("基础篇 · 第一月")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(UtaColor.ink)
                    Spacer()
                    Text("\(completedIDs.count)/\(CourseCatalog.lessons.count)")
                        .font(.system(size: 14, weight: .semibold, design: .rounded).monospacedDigit())
                        .foregroundStyle(UtaColor.indigo)
                }
                ProgressView(value: Double(completedIDs.count), total: Double(CourseCatalog.lessons.count))
                    .tint(UtaColor.indigo)
                if let nextLesson {
                    NavigationLink(value: nextLesson) {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(completedIDs.isEmpty ? "开始第一课" : "继续下一课")
                                    .font(.system(size: 11))
                                    .foregroundStyle(UtaColor.inkFaint)
                                Text(nextLesson.title)
                                    .font(.system(size: 17, weight: .semibold))
                                    .foregroundStyle(UtaColor.ink)
                                Text("今天 \(nextLesson.durationMinutes) 分钟，你会\(nextLesson.canDo)。")
                                    .font(.system(size: 12))
                                    .foregroundStyle(UtaColor.inkSoft)
                                    .lineLimit(2)
                            }
                            Spacer(minLength: 8)
                            Image(systemName: "play.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(.white)
                                .frame(width: 46, height: 46)
                                .background(Circle().fill(UtaColor.vermilion))
                        }
                    }
                    .buttonStyle(PressableStyle(scale: 0.98))
                } else {
                    Label("第一月课程已完成", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(UtaColor.matcha)
                }
            }
        }
    }

    private var reviewCallout: some View {
        NavigationLink {
            CourseReviewView()
        } label: {
            UtaCard(padding: 14) {
                HStack(spacing: 12) {
                    SealStamp(size: 28, character: "習")
                    VStack(alignment: .leading, spacing: 3) {
                        Text("有 \(dueCount) 个表达正在遗忘")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(UtaColor.ink)
                        Text("先花几分钟找回来，再学新内容")
                            .font(.system(size: 11.5))
                            .foregroundStyle(UtaColor.inkSoft)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(UtaColor.inkFaint)
                }
            }
        }
        .buttonStyle(PressableStyle(scale: 0.98))
    }

    private func weekSection(_ week: CourseWeek) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("第 \(week.id) 周 · \(week.subtitle)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(UtaColor.inkFaint)
                    Text(week.title)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(UtaColor.ink)
                }
                Spacer()
                Text(week.goal)
                    .font(.system(size: 10.5))
                    .foregroundStyle(UtaColor.indigo)
            }
            VStack(spacing: 10) {
                ForEach(week.lessons) { lesson in
                    lessonRow(lesson)
                }
            }
        }
    }

    @ViewBuilder
    private func lessonRow(_ lesson: CourseLesson) -> some View {
        let completed = completedIDs.contains(lesson.id)
        let nextSequence = nextLesson?.sequence ?? (CourseCatalog.lessons.count + 1)
        let locked = lesson.sequence > nextSequence
        Group {
            if locked {
                lessonLabel(lesson, completed: completed, locked: true)
            } else {
                NavigationLink(value: lesson) {
                    lessonLabel(lesson, completed: completed, locked: false)
                }
                .buttonStyle(PressableStyle(scale: 0.985))
            }
        }
    }

    private func lessonLabel(_ lesson: CourseLesson, completed: Bool, locked: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(completed ? UtaColor.matcha.opacity(0.14) : UtaColor.paperInset)
                    .frame(width: 38, height: 38)
                if completed {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(UtaColor.matcha)
                } else if locked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(UtaColor.inkFaint)
                } else {
                    Text("\(lesson.day)")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundStyle(UtaColor.indigo)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(lesson.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(locked ? UtaColor.inkFaint : UtaColor.ink)
                    if lesson.isWeeklyPerformance {
                        Chip(text: "周作品", color: UtaColor.vermilion, filled: true)
                    }
                }
                Text(lesson.primaryPhrase.text)
                    .font(.lyric(12))
                    .foregroundStyle(UtaColor.inkSoft)
                    .lineLimit(1)
            }
            Spacer()
            Text("\(lesson.durationMinutes)分")
                .font(.system(size: 10.5))
                .foregroundStyle(UtaColor.inkFaint)
        }
        .padding(.horizontal, 13)
        .frame(minHeight: 62)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(UtaColor.paperRaised.opacity(locked ? 0.55 : 1)))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(UtaColor.hairline, lineWidth: 0.7))
    }

    private var betaRoadmap: some View {
        UtaCard {
            VStack(alignment: .leading, spacing: 8) {
                Label("内测课程路线", systemImage: "map.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(UtaColor.indigo)
                Text("当前内置“零基础第一月”完整内容。N5 → N4 → N3 → N2 将沿同一进度与复习系统持续下发，不会重置你的学习记录。")
                    .font(.system(size: 12.5))
                    .foregroundStyle(UtaColor.inkSoft)
                    .lineSpacing(3)
            }
        }
    }
}

private struct CourseSetupView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @State private var dailyMinutes = 60
    @State private var selectedInterests: Set<String> = ["音乐", "旅行"]

    private let minuteOptions = [30, 45, 60, 75]
    private let interests = ["音乐", "旅行", "动漫", "生活", "职场"]

    var body: some View {
        NavigationStack {
            ZStack {
                PaperBackground(tint: UtaColor.indigo)
                ScrollView {
                    VStack(alignment: .leading, spacing: 26) {
                        VStack(alignment: .leading, spacing: 9) {
                            SealStamp(size: 48, character: "始")
                            Text("把一年目标，拆成今天能完成的一课")
                                .font(.system(size: 24, weight: .bold))
                                .foregroundStyle(UtaColor.ink)
                            Text("课程从零基础开始。忙时可以只做 12 分钟保底课，但一年挑战 N2 建议大多数学习日投入 60 分钟以上。")
                                .font(.system(size: 13.5))
                                .foregroundStyle(UtaColor.inkSoft)
                                .lineSpacing(4)
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            Text("每天计划")
                                .font(.system(size: 16, weight: .semibold))
                            HStack(spacing: 9) {
                                ForEach(minuteOptions, id: \.self) { value in
                                    Button {
                                        dailyMinutes = value
                                    } label: {
                                        Text("\(value)分")
                                            .font(.system(size: 13, weight: .medium))
                                            .frame(maxWidth: .infinity)
                                            .frame(height: 40)
                                            .background(
                                                Capsule().fill(dailyMinutes == value
                                                    ? UtaColor.indigo : UtaColor.paperInset))
                                            .foregroundStyle(dailyMinutes == value ? .white : UtaColor.ink)
                                    }
                                    .buttonStyle(PressableStyle())
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            Text("感兴趣的场景")
                                .font(.system(size: 16, weight: .semibold))
                            FlowLayout(alignment: .leading, spacing: 9, rowSpacing: 9) {
                                ForEach(interests, id: \.self) { interest in
                                    Button {
                                        if selectedInterests.contains(interest) {
                                            if selectedInterests.count > 1 { selectedInterests.remove(interest) }
                                        } else {
                                            selectedInterests.insert(interest)
                                        }
                                    } label: {
                                        Chip(
                                            text: interest,
                                            color: selectedInterests.contains(interest) ? UtaColor.indigo : UtaColor.inkSoft,
                                            filled: selectedInterests.contains(interest))
                                    }
                                    .buttonStyle(PressableStyle())
                                }
                            }
                        }

                        Button {
                            context.insert(CourseProfile(
                                dailyMinutes: dailyMinutes,
                                interests: Array(selectedInterests).sorted()))
                            try? context.save()
                            dismiss()
                        } label: {
                            Text("开始第一课")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .background(Capsule().fill(UtaColor.vermilion))
                        }
                        .buttonStyle(PressableStyle())
                    }
                    .padding(24)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

