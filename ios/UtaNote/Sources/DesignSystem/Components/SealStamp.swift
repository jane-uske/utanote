import SwiftUI

/// 朱印——UtaNote 的签名元素。收藏一句歌词 = 盖一枚章。
struct SealStamp: View {
    var size: CGFloat = 26
    var character: String = "収"

    var body: some View {
        ZStack {
            Circle()
                .fill(UtaColor.vermilion.opacity(0.92))
            Circle()
                .strokeBorder(.white.opacity(0.35), lineWidth: max(1, size * 0.045))
                .padding(size * 0.08)
            Text(character)
                .font(.lyric(size * 0.5, heavy: true))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(-8))
    }
}

/// 收藏开关：未收藏是虚线印框，收藏后「啪」地盖上朱印。
struct StampToggle: View {
    let isOn: Bool
    var size: CGFloat = 28

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(style: StrokeStyle(lineWidth: 1.2, dash: [3, 2.5]))
                .foregroundStyle(UtaColor.inkFaint)
                .frame(width: size, height: size)
                .opacity(isOn ? 0 : 1)
            if isOn {
                SealStamp(size: size)
                    .transition(
                        .asymmetric(
                            insertion: .scale(scale: 1.7).combined(with: .opacity),
                            removal: .scale(scale: 0.6).combined(with: .opacity)))
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.6), value: isOn)
    }
}
