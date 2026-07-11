import SafariServices
import SwiftUI

// MARK: - 应用内浏览器

/// 应用内 Safari（查歌词等场景），用户浏览与复制都发生在系统浏览器沙箱里。
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

// MARK: - 背景

struct PaperBackground: View {
    var tint: Color? = nil

    var body: some View {
        ZStack {
            UtaColor.paper
            if let tint {
                tint.opacity(0.05)
            }
            GrainOverlay(opacity: 0.035)
        }
        .ignoresSafeArea()
    }
}

/// 和纸颗粒感，确定性噪点。
struct GrainOverlay: View {
    var opacity: Double = 0.05

    var body: some View {
        Canvas { context, size in
            var rng = SeededGenerator(seed: 20260711)
            let count = Int(size.width * size.height / 300)
            for _ in 0..<count {
                let x = Double.random(in: 0..<max(1, size.width), using: &rng)
                let y = Double.random(in: 0..<max(1, size.height), using: &rng)
                let w = Double.random(in: 0.4...1.1, using: &rng)
                let bright = Double.random(in: 0...1, using: &rng) > 0.5
                context.fill(
                    Path(CGRect(x: x, y: y, width: w, height: w)),
                    with: .color((bright ? Color.white : Color.black).opacity(opacity)))
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }
}

struct SeededGenerator: RandomNumberGenerator {
    var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E37_79B9_7F4A_7C15 }
    mutating func next() -> UInt64 {
        state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        var z = state
        z = (z ^ (z >> 33)) &* 0xFF51_AFD7_ED55_8CCD
        return z ^ (z >> 33)
    }
}

// MARK: - 卡片与小件

struct UtaCard<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(UtaColor.paperRaised)
                    .shadow(color: .black.opacity(0.05), radius: 10, y: 3))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(UtaColor.hairline, lineWidth: 0.8))
    }
}

struct SectionHeader: View {
    let title: String
    var kicker: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if let kicker {
                Text(kicker)
                    .font(.lyric(11))
                    .foregroundStyle(UtaColor.inkFaint)
                    .kerning(2)
            }
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(UtaColor.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct Chip: View {
    let text: String
    var color: Color = UtaColor.inkSoft
    var filled: Bool = false

    var body: some View {
        Text(text)
            .font(.system(size: 11.5, weight: .medium))
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 8)
            .padding(.vertical, 3.5)
            .background(Capsule().fill(filled ? color.opacity(0.14) : Color.clear))
            .overlay(Capsule().strokeBorder(color.opacity(filled ? 0 : 0.45), lineWidth: 0.8))
            .foregroundStyle(color)
    }
}

struct EmotionBadge: View {
    let emotion: EmotionTag

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(emotion.kind.color).frame(width: 6, height: 6)
            Text(emotion.kind.label).font(.system(size: 12, weight: .medium))
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(Capsule().fill(emotion.kind.color.opacity(0.12)))
        .foregroundStyle(emotion.kind.color)
    }
}

// MARK: - 按钮

struct PressableStyle: ButtonStyle {
    var scale: CGFloat = 0.96
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

struct PillButton: View {
    let title: String
    var icon: String? = nil
    var prominent: Bool = false
    let action: () -> Void

    init(_ title: String, icon: String? = nil, prominent: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.prominent = prominent
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let icon {
                    Image(systemName: icon).font(.system(size: 13))
                }
                Text(title).font(.system(size: 13.5, weight: .medium))
            }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(
                Capsule().fill(prominent ? AnyShapeStyle(UtaColor.vermilion) : AnyShapeStyle(UtaColor.paperInset)))
            .foregroundStyle(prominent ? Color.white : UtaColor.ink)
        }
        .buttonStyle(PressableStyle())
    }
}

/// TTS 朗读按钮，朗读中显示动态波形符号。
struct SpeakButton: View {
    let title: String
    let icon: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: active ? "waveform" : icon)
                    .font(.system(size: 13))
                    .symbolEffect(.variableColor, isActive: active)
                Text(title).font(.system(size: 13, weight: .medium))
            }
            .padding(.horizontal, 13)
            .frame(height: 34)
            .background(Capsule().fill(UtaColor.indigo.opacity(active ? 0.18 : 0.10)))
            .foregroundStyle(UtaColor.indigo)
        }
        .buttonStyle(PressableStyle())
    }
}

// MARK: - 反馈可视化

struct ScoreRing: View {
    let score: Int
    var size: CGFloat = 110
    @State private var progress: Double = 0

    private var color: Color {
        score >= 85 ? UtaColor.matcha : score >= 65 ? UtaColor.indigo : UtaColor.vermilion
    }

    var body: some View {
        ZStack {
            Circle().stroke(UtaColor.hairline, lineWidth: size * 0.06)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: size * 0.06, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(score)")
                    .font(.system(size: size * 0.3, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(UtaColor.ink)
                Text("点")
                    .font(.lyric(size * 0.12))
                    .foregroundStyle(UtaColor.inkSoft)
            }
        }
        .frame(width: size, height: size)
        .onAppear {
            withAnimation(.spring(response: 0.9, dampingFraction: 0.85)) {
                progress = Double(score) / 100
            }
        }
    }
}

struct WaveformView: View {
    let levels: [Float]
    var color: Color = UtaColor.vermilion

    var body: some View {
        HStack(alignment: .center, spacing: 2.5) {
            ForEach(Array(levels.suffix(48).enumerated()), id: \.offset) { _, level in
                Capsule()
                    .fill(color.opacity(0.85))
                    .frame(width: 2.5, height: max(3, CGFloat(level) * 46))
            }
        }
        .frame(height: 50)
        .animation(.linear(duration: 0.05), value: levels)
    }
}
