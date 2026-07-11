import SwiftUI
import SwiftData

@main
struct UtaNoteApp: App {
    @State private var model = AppModel()
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(
                for: SavedLine.self, ReviewCard.self, PracticeRecord.self, SongProgress.self,
                ImportedSongRecord.self, CourseProfile.self, CourseLessonProgress.self,
                CourseSpeakingRecord.self, CourseReviewCard.self)
        } catch {
            // 本地库不可用时退回内存库，保证 App 始终能打开
            let memory = ModelConfiguration(isStoredInMemoryOnly: true)
            container = try! ModelContainer(
                for: SavedLine.self, ReviewCard.self, PracticeRecord.self, SongProgress.self,
                ImportedSongRecord.self, CourseProfile.self, CourseLessonProgress.self,
                CourseSpeakingRecord.self, CourseReviewCard.self,
                configurations: memory)
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .modelContainer(container)
                .tint(UtaColor.indigo)
        }
    }
}
