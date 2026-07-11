import SwiftUI
import UIKit

/// UtaNote 色彩系统：和纸 × 墨 × 朱印 × 藍。
/// 朱色只用于「印章时刻」（收藏、录音）；藍色承担常规交互。
enum UtaColor {
    /// 和纸底色
    static let paper = dynamic(0xF6F4EF, 0x191719)
    /// 浮起的卡片
    static let paperRaised = dynamic(0xFFFEFA, 0x211F24)
    /// 内凹的填充（输入框、次级底）
    static let paperInset = dynamic(0xEDE9DF, 0x26242A)
    /// 墨——主文字
    static let ink = dynamic(0x282520, 0xE9E5DC)
    /// 淡墨——次级文字
    static let inkSoft = dynamic(0x6E675D, 0xA59E92)
    /// 极淡墨——脚注、占位
    static let inkFaint = dynamic(0x9B9388, 0x6E6860)
    /// 发丝分隔线
    static let hairline = dynamic(0xE3DED3, 0x36333A)
    /// 朱肉——印章红，克制使用
    static let vermilion = dynamic(0xBF4B3E, 0xD26A5C)
    /// 藍鉄——功能与链接
    static let indigo = dynamic(0x46587A, 0x93A5C4)
    /// 抹茶——好成绩
    static let matcha = dynamic(0x5E8C6A, 0x7FAE8B)
    /// 播放器「夜舞台」底色，不随系统外观变化
    static let stageInk = Color(red: 0.075, green: 0.07, blue: 0.085)

    static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(rgb: dark) : UIColor(rgb: light)
        })
    }
}

extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1)
    }
}

extension Color {
    /// 歌曲封面色："#RRGGBB"
    init(hex: String) {
        var value: UInt64 = 0
        let body = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        Scanner(string: body).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255)
    }

    /// 压暗，用于播放器把封面色「夜化」
    func darkened(_ amount: Double) -> Color {
        let ui = UIColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        ui.getRed(&r, green: &g, blue: &b, alpha: &a)
        let k = CGFloat(1 - amount)
        return Color(red: r * k, green: g * k, blue: b * k)
    }
}
