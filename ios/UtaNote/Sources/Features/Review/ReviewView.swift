import SwiftData
import SwiftUI

/// 复习页：到期队列 + 翻卡自评 + 空状态。
struct ReviewView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \ReviewCard.dueAt) private var cards: [ReviewCard]
    @Query(sort: \CourseReviewCard.dueAt) private var courseCards: [CourseReviewCard]

    /// 非 nil 时进入复习会话（覆盖式切换，避免与播放器全屏弹层冲突）
    @State private var sessionItems: [ReviewItem]?
    @State private var showsCourseReview = false

    var body: some View {
        let now = Date.now
        let items = resolvedItems()
        let due = items.filter { $0.card.dueAt <= now }
        ZStack {
            PaperBackground()
            if let sessionItems {
                ReviewSessionView(items: sessionItems) {
                    withAnimation(.easeOut(duration: 0.22)) { self.sessionItems = nil }
                }
                .transition(.opacity)
                .zIndex(1)
            } else {
                overview(items: items, due: due, now: now)
            }
        }
        .toolbar(sessionItems == nil ? Visibility.automatic : .hidden, for: .tabBar)
        .sheet(isPresented: $showsCourseReview) {
            NavigationStack { CourseReviewView() }
        }
    }

    // MARK: - 总览

    private func overview(items: [ReviewItem], due: [ReviewItem], now: Date) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 26) {
                header
                if courseDueCount > 0 {
                    courseReviewSummary
                }
                if items.isEmpty {
                    emptyState
                } else if due.isEmpty {
                    restState(items: items, now: now)
                } else {
                    dueSummary(due: due, total: items.count)
                }
                Color.clear.frame(height: 16)
            }
            .padding(.horizontal, 20)
        }
    }

    private var courseDueCount: Int {
        courseCards.filter { $0.dueAt <= .now }.count
    }

    private var courseReviewSummary: some View {
        Button {
            showsCourseReview = true
        } label: {
            UtaCard(padding: 15) {
                HStack(spacing: 13) {
                    ZStack {
                        Circle()
                            .fill(UtaColor.indigo.opacity(0.12))
                            .frame(width: 46, height: 46)
                        Text("習")
                            .font(.lyric(20, heavy: true))
                            .foregroundStyle(UtaColor.indigo)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("课程表达 · \(courseDueCount) 项到期")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(UtaColor.ink)
                        Text("看中文说日语，找回正在遗忘的句子")
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

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("おさらい")
                .font(.lyric(11))
                .foregroundStyle(UtaColor.inkFaint)
                .kerning(2)
            Text("复习")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(UtaColor.ink)
        }
        .padding(.top, 16)
    }

    /// ③ 一张卡都没有：虚线印框（还没盖上的章）
    private var emptyState: some View {
        VStack(spacing: 20) {
            Circle()
                .strokeBorder(style: StrokeStyle(lineWidth: 1.3, dash: [4, 3.5]))
                .foregroundStyle(UtaColor.inkFaint)
                .frame(width: 76, height: 76)
                .overlay(
                    Text("復")
                        .font(.lyric(30, heavy: true))
                        .foregroundStyle(UtaColor.inkFaint.opacity(0.8)))
                .rotationEffect(.degrees(-8))
            VStack(spacing: 8) {
                Text("还没有要复习的歌词")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(UtaColor.ink)
                Text("在播放器长按歌词收藏，或跟读得分不佳时，会自动出现在这里")
                    .font(.system(size: 12.5))
                    .foregroundStyle(UtaColor.inkSoft)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .padding(.horizontal, 24)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 90)
    }

    /// ④ 有卡但今天都不到期
    private func restState(items: [ReviewItem], now: Date) -> some View {
        UtaCard(padding: 20) {
            VStack(spacing: 12) {
                Text("休")
                    .font(.lyric(22, heavy: true))
                    .foregroundStyle(UtaColor.matcha)
                    .frame(width: 52, height: 52)
                    .background(Circle().fill(UtaColor.matcha.opacity(0.12)))
                Text("今天没有到期的复习")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(UtaColor.ink)
                if let next = items.first(where: { $0.card.dueAt > now }) {
                    Text("下一句将在 \(relativeDescription(of: next.card.dueAt, from: now))到期")
                        .font(.system(size: 12.5))
                        .foregroundStyle(UtaColor.inkSoft)
                }
                Rectangle().fill(UtaColor.hairline).frame(height: 0.6)
                Text("共 \(items.count) 句歌词在复习计划中")
                    .font(.system(size: 11.5))
                    .foregroundStyle(UtaColor.inkFaint)
            }
            .frame(maxWidth: .infinity)
        }
    }

    /// ⑤ 有到期卡：摘要 + 开始复习
    private func dueSummary(due: [ReviewItem], total: Int) -> some View {
        UtaCard(padding: 20) {
            VStack(spacing: 16) {
                HStack(spacing: 14) {
                    SealStamp(size: 34, character: "復")
                    VStack(alignment: .leading, spacing: 3) {
                        Text("今天有 \(due.count) 句待复习")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(UtaColor.ink)
                        Text("每句几秒钟，想起来就算数。")
                            .font(.system(size: 12.5))
                            .foregroundStyle(UtaColor.inkSoft)
                    }
                    Spacer(minLength: 0)
                }
                Button {
                    Haptics.tap()
                    withAnimation(.easeOut(duration: 0.22)) { sessionItems = due }
                } label: {
                    Text("开始复习")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .background(Capsule().fill(UtaColor.indigo))
                }
                .buttonStyle(PressableStyle())
                Text("共 \(total) 句在复习计划中")
                    .font(.system(size: 11))
                    .foregroundStyle(UtaColor.inkFaint)
            }
        }
    }

    // MARK: - 数据

    /// 解析卡对应的歌与行，解析失败的卡跳过（保持 dueAt 升序）
    private func resolvedItems() -> [ReviewItem] {
        cards.compactMap { card in
            guard let song = app.song(withID: card.songID),
                  let line = song.line(withID: card.lineID) else { return nil }
            return ReviewItem(card: card, song: song, line: line)
        }
    }

    private func relativeDescription(of date: Date, from now: Date) -> String {
        let seconds = max(0, date.timeIntervalSince(now))
        if seconds < 3600 {
            return "\(max(1, Int(seconds / 60))) 分钟后"
        }
        if seconds < 86400 {
            return "\(Int(seconds / 3600)) 小时后"
        }
        return "\(Int((seconds / 86400).rounded(.up))) 天后"
    }
}

// MARK: - 会话数据

private struct ReviewItem {
    let card: ReviewCard
    let song: Song
    let line: LyricLine
}

// MARK: - 复习会话

/// ⑥⑦ 一次一张翻卡自评，评完出完成页。
private struct ReviewSessionView: View {
    let items: [ReviewItem]
    let onClose: () -> Void

    @Environment(AppModel.self) private var app
    @State private var index = 0
    @State private var revealed = false
    @State private var againCount = 0
    @State private var goodCount = 0
    @State private var easyCount = 0

    private var isFinished: Bool { index >= items.count }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            ZStack {
                if isFinished {
                    completion
                        .transition(.opacity.combined(with: .scale(scale: 0.96)))
                } else {
                    stage(items[index])
                        .id(index)
                        .transition(
                            .asymmetric(
                                insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal: .move(edge: .leading).combined(with: .opacity)))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onDisappear { app.tts.stop() }
    }

    private var topBar: some View {
        HStack {
            Button {
                app.tts.stop()
                onClose()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(UtaColor.inkSoft)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(UtaColor.paperInset))
                    .contentShape(Circle())
            }
            .buttonStyle(PressableStyle())
            Spacer()
            if !isFinished {
                Text("\(index + 1) / \(items.count)")
                    .font(.timecode)
                    .foregroundStyle(UtaColor.inkFaint)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
    }

    // MARK: - 卡片舞台

    private func stage(_ item: ReviewItem) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 16)
            UtaCard(padding: 24) {
                VStack(spacing: 20) {
                    Chip(text: item.song.title, color: UtaColor.indigo)
                    ZStack {
                        if revealed {
                            back(item)
                                .transition(.opacity.combined(with: .scale(scale: 0.98)))
                        } else {
                            front(item)
                                .transition(.opacity)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }
            Spacer(minLength: 16)
            controls(item)
        }
        .padding(.horizontal, 20)
    }

    /// 正面：只有歌词原文
    private func front(_ item: ReviewItem) -> some View {
        Text(item.line.text)
            .font(.lyric(22, heavy: true))
            .foregroundStyle(UtaColor.ink)
            .multilineTextAlignment(.center)
            .lineSpacing(6)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
    }

    /// 背面：读音 + 意思 + 朗读 + 回到原曲
    private func back(_ item: ReviewItem) -> some View {
        VStack(spacing: 16) {
            RubyText(tokens: item.line.tokens, surfaceSize: 22, alignment: .center)
                .frame(maxWidth: .infinity)
            Text(item.line.translation)
                .font(.system(size: 14))
                .foregroundStyle(UtaColor.inkSoft)
                .multilineTextAlignment(.center)
            HStack(spacing: 14) {
                SpeakButton(
                    title: "朗读",
                    icon: "speaker.wave.2.fill",
                    active: app.tts.activeUtteranceKey == item.card.lineID
                ) {
                    app.tts.toggle(item.line.text, key: item.card.lineID)
                }
                Button {
                    app.tts.stop()
                    onClose()
                    app.openPlayerForStudy(item.song, lineID: item.line.id)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.uturn.left")
                            .font(.system(size: 11))
                        Text("回到原曲")
                    }
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(UtaColor.indigo)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - 底部操作

    @ViewBuilder
    private func controls(_ item: ReviewItem) -> some View {
        ZStack {
            if revealed {
                HStack(spacing: 10) {
                    ForEach(ReviewGrade.allCases, id: \.self) { grade in
                        gradeButton(grade, for: item)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            } else {
                Button {
                    Haptics.selection()
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                        revealed = true
                    }
                } label: {
                    Text("显示读音和意思")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .background(Capsule().fill(UtaColor.indigo))
                }
                .buttonStyle(PressableStyle())
                .transition(.opacity)
            }
        }
        .padding(.bottom, 28)
    }

    private func gradeButton(_ grade: ReviewGrade, for item: ReviewItem) -> some View {
        Button {
            submit(grade, for: item)
        } label: {
            Text(grade.label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(grade == .again ? UtaColor.vermilion : UtaColor.ink)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(Capsule().fill(UtaColor.paperRaised))
                .overlay(Capsule().strokeBorder(UtaColor.hairline, lineWidth: 0.8))
        }
        .buttonStyle(PressableStyle())
    }

    private func submit(_ grade: ReviewGrade, for item: ReviewItem) {
        UserDataStore.grade(item.card, grade: grade)
        switch grade {
        case .again: againCount += 1
        case .good: goodCount += 1
        case .easy: easyCount += 1
        }
        if grade == .again {
            Haptics.tap()
        } else {
            Haptics.success()
        }
        app.tts.stop()
        withAnimation(.spring(response: 0.38, dampingFraction: 0.85)) {
            revealed = false
            index += 1
        }
    }

    // MARK: - 完成页

    private var completion: some View {
        VStack(spacing: 18) {
            SealStamp(size: 40, character: "済")
            Text("今日复习完成")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(UtaColor.ink)
            UtaCard(padding: 0) {
                HStack(spacing: 0) {
                    stat(count: againCount, label: ReviewGrade.again.label)
                    statDivider
                    stat(count: goodCount, label: ReviewGrade.good.label)
                    statDivider
                    stat(count: easyCount, label: ReviewGrade.easy.label)
                }
                .padding(.vertical, 14)
            }
            Button {
                app.tab = .home
                onClose()
            } label: {
                Text("回到今日")
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 36)
                    .frame(height: 44)
                    .background(Capsule().fill(UtaColor.indigo))
            }
            .buttonStyle(PressableStyle())
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 20)
        .onAppear { Haptics.stamp() }
    }

    private func stat(count: Int, label: String) -> some View {
        VStack(spacing: 3) {
            Text("\(count)")
                .font(.system(size: 22, weight: .semibold, design: .rounded).monospacedDigit())
                .foregroundStyle(UtaColor.ink)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(UtaColor.inkSoft)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle().fill(UtaColor.hairline).frame(width: 0.6, height: 36)
    }
}
