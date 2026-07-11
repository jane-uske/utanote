import SwiftUI

extension Font {
    /// 歌词与日文展示字体：明朝体（Hiragino Mincho ProN，iOS 内置）
    static func lyric(_ size: CGFloat, heavy: Bool = false) -> Font {
        .custom(heavy ? "HiraMinProN-W6" : "HiraMinProN-W3", size: size)
    }

    /// 跟随 Dynamic Type 缩放的明朝体
    static func lyricScaled(_ size: CGFloat, heavy: Bool = false, relativeTo style: TextStyle = .body) -> Font {
        .custom(heavy ? "HiraMinProN-W6" : "HiraMinProN-W3", size: size, relativeTo: style)
    }

    /// 假名注音
    static func ruby(_ size: CGFloat) -> Font {
        .system(size: size, weight: .regular)
    }

    /// 时间码等宽数字
    static var timecode: Font {
        .system(size: 12, weight: .medium, design: .rounded).monospacedDigit()
    }
}

/// mm:ss
func timecode(_ seconds: Double) -> String {
    let total = max(0, Int(seconds.rounded()))
    return String(format: "%d:%02d", total / 60, total % 60)
}
