import SwiftData
import SwiftUI

/// 歌曲详情：封面 + 故事 + 数据一览 + 开始学习 + 全部歌词。
struct SongDetailView: View {
    let song: Song

    @Environment(AppModel.self) private var app
    @Query private var savedLines: [SavedLine]

    var body: some View {
        ZStack {
            PaperBackground(tint: song.accentColor)
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 26) {
                    hero
                    storySection
                    statsStrip
                    startButton
                    lyricsSection
                    Color.clear.frame(height: 24)
                }
                .padding(.horizontal, 20)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - 封面与题字

    private var hero: some View {
        VStack(spacing: 16) {
            CoverArtView(style: song.coverStyle, cornerRadius: 18)
                .frame(width: 160, height: 160)
                .shadow(color: .black.opacity(0.14), radius: 16, y: 8)
            VStack(spacing: 5) {
                Text(song.titleReading)
                    .font(.ruby(11))
                    .foregroundStyle(UtaColor.inkFaint)
                    .kerning(1)
                Text(song.title)
                    .font(.lyric(24, heavy: true))
                    .foregroundStyle(UtaColor.ink)
                    .multilineTextAlignment(.center)
                Text(song.titleTranslation)
                    .font(.system(size: 13))
                    .foregroundStyle(UtaColor.inkSoft)
                Text("\(song.artist) · \(song.level) · \(timecode(song.durationSec))")
                    .font(.system(size: 11.5).monospacedDigit())
                    .foregroundStyle(UtaColor.inkFaint)
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    // MARK: - 这首歌

    private var storySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "这首歌", kicker: "ものがたり")
            UtaCard {
                Text(song.storyIntro)
                    .font(.system(size: 13.5))
                    .foregroundStyle(UtaColor.ink)
                    .lineSpacing(5)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - 数据一览

    private var wordCount: Int {
        song.lines.reduce(0) { $0 + $1.words.count }
    }

    private var grammarCount: Int {
        song.lines.reduce(0) { $0 + $1.grammar.count }
    }

    private var savedCount: Int {
        savedLines.filter { $0.songID == song.id }.count
    }

    private var statsStrip: some View {
        UtaCard(padding: 0) {
            HStack(spacing: 0) {
                statColumn(value: song.lines.count, label: "句数")
                divider
                statColumn(value: wordCount, label: "词汇")
                divider
                statColumn(value: grammarCount, label: "语法点")
                divider
                statColumn(value: savedCount, label: "已收藏", highlight: savedCount > 0)
            }
            .padding(.vertical, 14)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(UtaColor.hairline)
            .frame(width: 0.6, height: 38)
    }

    private func statColumn(value: Int, label: String, highlight: Bool = false) -> some View {
        VStack(spacing: 3) {
            Text("\(value)")
                .font(.system(size: 20, weight: .semibold, design: .rounded).monospacedDigit())
                .foregroundStyle(highlight ? UtaColor.vermilion : UtaColor.ink)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(UtaColor.inkSoft)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - 开始学习

    private var startButton: some View {
        Button {
            app.openPlayer(song)
        } label: {
            HStack(spacing: 7) {
                Image(systemName: "play.fill")
                    .font(.system(size: 13))
                Text("开始学习这首歌")
                    .font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Capsule().fill(UtaColor.indigo))
        }
        .buttonStyle(PressableStyle())
    }

    // MARK: - 歌词

    private var lyricsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "歌词", kicker: "うたことば")
            UtaCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(song.lines.enumerated()), id: \.element.id) { index, line in
                        Button {
                            app.openPlayerForStudy(song, lineID: line.id)
                        } label: {
                            lyricRow(line)
                        }
                        .buttonStyle(.plain)
                        if index < song.lines.count - 1 {
                            Rectangle()
                                .fill(UtaColor.hairline)
                                .frame(height: 0.6)
                                .padding(.leading, 62)
                        }
                    }
                }
            }
        }
    }

    private func lyricRow(_ line: LyricLine) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(timecode(line.start))
                .font(.timecode)
                .foregroundStyle(UtaColor.inkFaint)
                .frame(width: 34, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
                Text(line.text)
                    .font(.lyric(15))
                    .foregroundStyle(UtaColor.ink)
                    .multilineTextAlignment(.leading)
                Text(line.translation)
                    .font(.system(size: 11.5))
                    .foregroundStyle(UtaColor.inkSoft)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
