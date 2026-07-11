import SwiftData
import SwiftUI

struct CourseReviewView: View {
    @Environment(AppModel.self) private var app
    @Query(sort: \CourseReviewCard.dueAt) private var cards: [CourseReviewCard]
    @State private var sessionIDs: [String] = []
    @State private var index = 0
    @State private var revealed = false
    @State private var started = false

    private var currentCard: CourseReviewCard? {
        guard sessionIDs.indices.contains(index) else { return nil }
        return cards.first { $0.reviewID == sessionIDs[index] }
    }

    var body: some View {
        ZStack {
            PaperBackground(tint: UtaColor.matcha)
            if !started {
                ProgressView()
            } else if let card = currentCard {
                review(card)
            } else {
                completion
            }
        }
        .navigationTitle("课程复习")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            guard !started else { return }
            sessionIDs = cards.filter { $0.dueAt <= .now }.map(\.reviewID)
            started = true
        }
        .onDisappear { app.tts.stop() }
    }

    private func review(_ card: CourseReviewCard) -> some View {
        VStack(spacing: 24) {
            HStack {
                Text("找回正在遗忘的表达")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(UtaColor.inkFaint)
                Spacer()
                Text("\(index + 1)/\(sessionIDs.count)")
                    .font(.system(size: 12, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(UtaColor.inkSoft)
            }
            .padding(.horizontal, 24)

            Spacer(minLength: 20)

            Button {
                withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) { revealed = true }
            } label: {
                UtaCard {
                    VStack(spacing: 22) {
                        Text(revealed ? "日语怎么说" : "请用日语说")
                            .font(.system(size: 11))
                            .foregroundStyle(UtaColor.inkFaint)
                            .kerning(1)
                        Text(card.prompt)
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(UtaColor.ink)
                            .multilineTextAlignment(.center)
                        if revealed {
                            Divider().overlay(UtaColor.hairline)
                            Text(card.answer)
                                .font(.lyric(26, heavy: true))
                                .foregroundStyle(UtaColor.ink)
                                .multilineTextAlignment(.center)
                            Text(card.reading)
                                .font(.lyric(12))
                                .foregroundStyle(UtaColor.indigo)
                            SpeakButton(
                                title: "听标准发音", icon: "speaker.wave.2.fill",
                                active: app.tts.activeUtteranceKey == "review-\(card.reviewID)"
                            ) {
                                app.tts.toggle(card.answer, key: "review-\(card.reviewID)")
                            }
                        } else {
                            Text("先说出口，再点卡片看答案")
                                .font(.system(size: 12))
                                .foregroundStyle(UtaColor.inkSoft)
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 280)
                }
            }
            .buttonStyle(PressableStyle(scale: 0.99))
            .padding(.horizontal, 22)

            Spacer()

            if revealed {
                HStack(spacing: 10) {
                    gradeButton(.again, color: UtaColor.vermilion)
                    gradeButton(.good, color: UtaColor.indigo)
                    gradeButton(.easy, color: UtaColor.matcha)
                }
                .padding(.horizontal, 20)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(.vertical, 16)
    }

    private func gradeButton(_ grade: CourseReviewGrade, color: Color) -> some View {
        Button {
            guard let card = currentCard else { return }
            CourseStore.grade(card, grade: grade)
            app.tts.stop()
            Haptics.tap()
            withAnimation(.easeOut(duration: 0.2)) {
                index += 1
                revealed = false
            }
        } label: {
            VStack(spacing: 4) {
                Text(grade.label)
                    .font(.system(size: 13.5, weight: .semibold))
                Text(nextIntervalLabel(grade))
                    .font(.system(size: 9.5))
                    .opacity(0.75)
            }
            .foregroundStyle(color)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Capsule().fill(color.opacity(0.11)))
        }
        .buttonStyle(PressableStyle())
    }

    private func nextIntervalLabel(_ grade: CourseReviewGrade) -> String {
        guard let card = currentCard else { return "" }
        let result = CourseReviewScheduler.apply(grade: grade, toBox: card.box, now: .now)
        let minutes = result.dueAt.timeIntervalSinceNow / 60
        if minutes < 60 { return "约 10 分钟" }
        let days = max(1, Int((minutes / 1_440).rounded()))
        return "约 \(days) 天"
    }

    private var completion: some View {
        VStack(spacing: 20) {
            SealStamp(size: 72, character: "復")
            Text(sessionIDs.isEmpty ? "今天没有到期课程卡" : "今天的表达都找回来了")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(UtaColor.ink)
            Text(sessionIDs.isEmpty ? "完成新课后，核心表达会自动进入这里。" : "短暂复习比一次背很久更能留下记忆。")
                .font(.system(size: 13.5))
                .foregroundStyle(UtaColor.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 36)
        }
    }
}

