import Foundation

/// 启动参数路由，用于自动化截图与调试直达指定页面。
/// 例：xcrun simctl launch booted com.rare.utanote --uta-route player --uta-demo-data
enum LaunchRoute: String {
    case home, course, lesson, library, review, notebook, player, study, practice, onboarding

    static var current: LaunchRoute? {
        guard let i = CommandLine.arguments.firstIndex(of: "--uta-route"),
              CommandLine.arguments.indices.contains(i + 1) else { return nil }
        return LaunchRoute(rawValue: CommandLine.arguments[i + 1])
    }

    static var wantsDemoData: Bool {
        CommandLine.arguments.contains("--uta-demo-data")
    }
}
