import SwiftUI

/// 生成式唱片封面：双色渐变 + 明朝体单字 + 唱片纹理。
struct CoverArtView: View {
    let style: CoverStyle
    var cornerRadius: CGFloat = 14

    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            ZStack {
                LinearGradient(
                    colors: style.swiftColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing)
                ForEach(0..<4, id: \.self) { i in
                    Circle()
                        .stroke(.white.opacity(0.07), lineWidth: 1)
                        .frame(width: side * (0.46 + 0.2 * Double(i)))
                }
                Circle()
                    .fill(.black.opacity(0.10))
                    .frame(width: side * 0.15)
                Text(style.glyph)
                    .font(.lyric(side * 0.42, heavy: true))
                    .foregroundStyle(.white.opacity(0.93))
                    .shadow(color: .black.opacity(0.20), radius: side * 0.02, y: 1)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .aspectRatio(1, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .strokeBorder(.white.opacity(0.14), lineWidth: 0.8))
    }
}
