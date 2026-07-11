import UIKit

enum Haptics {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    /// 盖章——收藏时刻专用
    static func stamp() {
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
}
