import SwiftUI

/// 带假名注音的歌词排版：每个 token 上方标注读音，自动换行。
struct RubyText: View {
    let tokens: [Token]
    var surfaceSize: CGFloat = 26
    var heavy: Bool = true
    var showRuby: Bool = true
    var surfaceColor: Color = UtaColor.ink
    var rubyColor: Color = UtaColor.inkSoft
    var alignment: HorizontalAlignment = .center

    var body: some View {
        FlowLayout(alignment: alignment, spacing: 0, rowSpacing: surfaceSize * 0.45) {
            ForEach(Array(tokens.enumerated()), id: \.offset) { _, token in
                TokenView(
                    token: token,
                    surfaceSize: surfaceSize,
                    heavy: heavy,
                    showRuby: showRuby,
                    surfaceColor: surfaceColor,
                    rubyColor: rubyColor)
            }
        }
    }

    private struct TokenView: View {
        let token: Token
        let surfaceSize: CGFloat
        let heavy: Bool
        let showRuby: Bool
        let surfaceColor: Color
        let rubyColor: Color

        var body: some View {
            if token.surface == " " || token.surface == "　" {
                Color.clear.frame(width: surfaceSize * 0.5, height: 1)
            } else {
                VStack(spacing: 2) {
                    Text(token.reading ?? " ")
                        .font(.ruby(max(9, surfaceSize * 0.42)))
                        .foregroundStyle(rubyColor)
                        .opacity(showRuby && token.reading != nil ? 1 : 0)
                        .lineLimit(1)
                        .fixedSize()
                    Text(token.surface)
                        .font(.lyric(surfaceSize, heavy: heavy))
                        .foregroundStyle(surfaceColor)
                        .lineLimit(1)
                        .fixedSize()
                }
                .padding(.horizontal, 1)
            }
        }
    }
}
