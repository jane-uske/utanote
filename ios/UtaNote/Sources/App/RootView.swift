import SwiftData
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @AppStorage("uta.hasOnboarded") private var hasOnboarded = false
    @State private var onboardingDismissed = false
    @State private var routeApplied = false

    var body: some View {
        @Bindable var app = app
        TabView(selection: $app.tab) {
            tabContent { HomeView() }
                .tabItem { Label("今日", systemImage: "sun.haze") }
                .tag(AppTab.home)
            tabContent { LibraryView() }
                .tabItem { Label("曲库", systemImage: "music.note.list") }
                .tag(AppTab.library)
            tabContent { ReviewView() }
                .tabItem { Label("复习", systemImage: "clock.arrow.circlepath") }
                .tag(AppTab.review)
            tabContent { NotebookView() }
                .tabItem { Label("歌词本", systemImage: "book.closed") }
                .tag(AppTab.notebook)
        }
        .fullScreenCover(isPresented: $app.isPlayerPresented) {
            if let song = app.audio.song {
                PlayerView(song: song)
            }
        }
        .fullScreenCover(item: $app.presentedImportedSong) { song in
            ImportedPlayerView(song: song)
        }
        .fullScreenCover(item: $app.presentedCourseLesson) { lesson in
            // 深链路径也要注册课程目的地，否则完成页的「查看下一课」推不动
            NavigationStack {
                CourseLessonView(lesson: lesson)
                    .navigationDestination(for: CourseLesson.self) { CourseLessonView(lesson: $0) }
            }
        }
        .fullScreenCover(isPresented: showsOnboarding) {
            OnboardingView()
        }
        .task {
            app.reloadImportedSongs(in: context)
            applyLaunchRoute()
        }
    }

    @ViewBuilder
    private func tabContent<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if app.audio.song != nil, !app.isPlayerPresented {
                    MiniPlayerBar()
                        .padding(.horizontal, 12)
                        .padding(.bottom, 6)
                }
            }
    }

    private var showsOnboarding: Binding<Bool> {
        Binding(
            get: {
                if onboardingDismissed { return false }
                if let route = LaunchRoute.current { return route == .onboarding }
                return !hasOnboarded
            },
            set: { newValue in
                if !newValue {
                    onboardingDismissed = true
                    hasOnboarded = true
                }
            })
    }

    // MARK: - 截图/调试路由

    private func applyLaunchRoute() {
        guard !routeApplied, let route = LaunchRoute.current else { return }
        routeApplied = true
        if LaunchRoute.wantsDemoData {
            seedDemoData()
        }
        guard let song = app.songs.first else { return }
        switch route {
        case .home: app.tab = .home
        case .course: app.tab = .home
        case .lesson:
            app.presentedCourseLesson = CourseCatalog.lessons.first
        case .library: app.tab = .library
        case .review: app.tab = .review
        case .notebook: app.tab = .notebook
        case .player:
            app.openPlayer(song)
        case .study:
            let line = song.lines[min(2, song.lines.count - 1)]
            app.openPlayerForStudy(song, lineID: line.id)
        case .practice:
            let line = song.lines[min(2, song.lines.count - 1)]
            app.pendingPracticeImmediately = true
            app.openPlayerForStudy(song, lineID: line.id)
        case .onboarding:
            break
        }
    }

    private func seedDemoData() {
        guard let song = app.songs.first else { return }
        if UserDataStore.savedLine(songID: song.id, lineID: song.lines[0].id, in: context) == nil {
            for (index, line) in song.lines.prefix(4).enumerated() {
                context.insert(
                    SavedLine(songID: song.id, lineID: line.id, note: index == 0 ? "整首歌最喜欢的一句。" : ""))
                UserDataStore.ensureReviewCard(songID: song.id, lineID: line.id, source: .saved, in: context)
            }
            if app.songs.count > 1 {
                let second = app.songs[1]
                for line in second.lines.prefix(2) {
                    context.insert(SavedLine(songID: second.id, lineID: line.id))
                    UserDataStore.ensureReviewCard(songID: second.id, lineID: line.id, source: .saved, in: context)
                }
            }
            context.insert(PracticeRecord(songID: song.id, lineID: song.lines[1].id, score: 82, transcript: nil))
            UserDataStore.markStudied(song: song, line: song.lines[2], in: context)
        }
        if CourseStore.profile(in: context) == nil {
            context.insert(CourseProfile(dailyMinutes: 60, interests: ["音乐", "旅行"]))
        }
        for lesson in CourseCatalog.lessons.prefix(2) {
            CourseStore.complete(lesson, quizPassed: true, liveCompleted: lesson.sequence == 1, in: context)
        }
    }
}
