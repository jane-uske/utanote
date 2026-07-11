import SwiftUI

/// 首次启动引导：三页「歌词集扉页」。
/// fullScreenCover 呈现；dismiss 由 RootView 映射为「完成引导」。
struct OnboardingView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var app
    @State private var page = 0

    var body: some View {
        ZStack {
            PaperBackground()

            VStack(spacing: 0) {
                TabView(selection: $page) {
                    FrontispiecePage(song: app.songs.first)
                        .tag(0)
                    TapLinePage()
                        .tag(1)
                    PracticePage { dismiss() }
                        .tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                bottomBar
            }
        }
    }

    // MARK: - 底栏：自绘页点 + 下一页

    private var bottomBar: some View {
        ZStack {
            PageDots(current: page, count: 3)

            HStack {
                Spacer()
                if page < 2 {
                    Button {
                        withAnimation(.easeInOut(duration: 0.35)) { page += 1 }
                    } label: {
                        HStack(spacing: 3) {
                            Text("下一页")
                                .font(.system(size: 14, weight: .medium))
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(UtaColor.indigo)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(PressableStyle())
                    .transition(.opacity)
                }
            }
            .padding(.trailing, 14)
        }
        .frame(height: 44)
        .padding(.bottom, 12)
        .animation(.easeInOut(duration: 0.25), value: page)
    }
}

// MARK: - 页点

private struct PageDots: View {
    let current: Int
    let count: Int

    var body: some View {
        HStack(spacing: 9) {
            ForEach(0..<count, id: \.self) { index in
                Circle()
                    .fill(index == current ? UtaColor.indigo : UtaColor.hairline)
                    .frame(
                        width: index == current ? 7 : 6,
                        height: index == current ? 7 : 6)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: current)
    }
}

// MARK: - 第 1 页 · 扉页

private struct FrontispiecePage: View {
    let song: Song?
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            Group {
                if let song {
                    CoverArtView(style: song.coverStyle, cornerRadius: 20)
                        .frame(width: 120, height: 120)
                        .shadow(color: .black.opacity(0.12), radius: 14, y: 7)
                } else {
                    SealStamp(size: 72, character: "歌")
                }
            }
            .opacity(appeared ? 1 : 0)
            .scaleEffect(appeared ? 1 : 0.94)
            .animation(.easeOut(duration: 0.7), value: appeared)

            Text("うたノート")
                .font(.lyric(30, heavy: true))
                .foregroundStyle(UtaColor.ink)
                .kerning(3)
                .padding(.top, 40)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 8)
                .animation(.easeOut(duration: 0.6).delay(0.15), value: appeared)

            Text("用喜欢的歌，学会日语")
                .font(.system(size: 15))
                .foregroundStyle(UtaColor.inkSoft)
                .kerning(1)
                .padding(.top, 14)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 8)
                .animation(.easeOut(duration: 0.6).delay(0.3), value: appeared)

            Spacer(minLength: 0)

            Text("原创演示歌曲 · 无需登录")
                .font(.system(size: 11))
                .foregroundStyle(UtaColor.inkFaint)
                .kerning(1)
                .padding(.bottom, 18)
                .opacity(appeared ? 1 : 0)
                .animation(.easeOut(duration: 0.6).delay(0.45), value: appeared)
        }
        .padding(.horizontal, 32)
        .onAppear { appeared = true }
    }
}

// MARK: - 第 2 页 · 点一句歌词

private struct TapLinePage: View {
    @State private var appeared = false

    private let demoTokens: [Token] = [
        Token(surface: "夜", reading: "よる"),
        Token(surface: "の", reading: nil),
        Token(surface: "窓", reading: "まど"),
        Token(surface: "に", reading: nil),
        Token(surface: "　", reading: nil),
        Token(surface: "歌", reading: "うた"),
        Token(surface: "が", reading: nil),
        Token(surface: "灯", reading: "とも"),
        Token(surface: "る", reading: nil),
    ]

    private let facets = ["假名", "翻译", "词汇", "语法", "情绪"]

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            Text("点一句，读懂一句")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(UtaColor.ink)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 8)
                .animation(.easeOut(duration: 0.6), value: appeared)

            RubyText(tokens: demoTokens, surfaceSize: 24)
                .padding(.top, 44)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 8)
                .animation(.easeOut(duration: 0.6).delay(0.15), value: appeared)

            UtaCard(padding: 13) {
                HStack(spacing: 7) {
                    ForEach(facets, id: \.self) { facet in
                        Chip(text: facet, color: UtaColor.indigo)
                    }
                }
            }
            .padding(.top, 32)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 8)
            .animation(.easeOut(duration: 0.6).delay(0.3), value: appeared)

            Text("每一句歌词，都是一堂两分钟的小课")
                .font(.system(size: 13))
                .foregroundStyle(UtaColor.inkSoft)
                .padding(.top, 28)
                .opacity(appeared ? 1 : 0)
                .animation(.easeOut(duration: 0.6).delay(0.45), value: appeared)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 32)
        .onAppear { appeared = true }
    }
}

// MARK: - 第 3 页 · 跟读与收藏

private struct PracticePage: View {
    let onStart: () -> Void
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            Text("跟读与收藏")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(UtaColor.ink)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 8)
                .animation(.easeOut(duration: 0.6), value: appeared)

            VStack(alignment: .leading, spacing: 26) {
                featureRow(text: "跟读，听 AI 给你反馈", delay: 0.15) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 19))
                        .foregroundStyle(UtaColor.indigo)
                }
                featureRow(text: "长按收藏，盖上你的印章", delay: 0.28) {
                    SealStamp(size: 20)
                }
                featureRow(text: "到期复习，别让喜欢的句子溜走", delay: 0.41) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 19))
                        .foregroundStyle(UtaColor.indigo)
                }
            }
            .padding(.horizontal, 48)
            .padding(.top, 44)

            Button(action: onStart) {
                Text("开始")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .kerning(2)
                    .frame(maxWidth: 280)
                    .frame(height: 50)
                    .background(Capsule().fill(UtaColor.vermilion))
            }
            .buttonStyle(PressableStyle())
            .padding(.horizontal, 40)
            .padding(.top, 52)
            .opacity(appeared ? 1 : 0)
            .animation(.easeOut(duration: 0.6).delay(0.55), value: appeared)

            Spacer(minLength: 0)
        }
        .onAppear { appeared = true }
    }

    private func featureRow(
        text: String,
        delay: Double,
        @ViewBuilder icon: () -> some View
    ) -> some View {
        HStack(spacing: 16) {
            icon()
                .frame(width: 30, height: 30)
            Text(text)
                .font(.system(size: 14.5))
                .foregroundStyle(UtaColor.ink)
            Spacer(minLength: 0)
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 8)
        .animation(.easeOut(duration: 0.55).delay(delay), value: appeared)
    }
}
