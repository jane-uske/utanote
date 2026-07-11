import AVFoundation
import XCTest

@testable import UtaNote

/// 内容包不变量：所有随包歌曲必须结构完好、时间轴单调、token 与原文一致、音频在场。
final class ContentTests: XCTestCase {
    func testBundledSongsLoadAndAreWellFormed() throws {
        let songs = SongLibrary.loadBundled()
        XCTAssertGreaterThanOrEqual(songs.count, 3, "应至少内置 3 首演示歌")

        for song in songs {
            XCTAssertFalse(song.lines.isEmpty, "\(song.id) 没有歌词行")
            XCTAssertEqual(song.coverStyle.colors.count, 2, "\(song.id) 封面色数量错误")
            XCTAssertEqual(song.coverStyle.glyph.count, 1)

            var previousStart = -Double.infinity
            var previousEnd = 0.0
            var seenIDs = Set<String>()
            for line in song.lines {
                XCTAssertTrue(seenIDs.insert(line.id).inserted, "\(song.id) 行 id 重复: \(line.id)")
                XCTAssertLessThan(line.start, line.end, "\(song.id)/\(line.id) start >= end")
                XCTAssertGreaterThan(line.start, previousStart, "\(song.id)/\(line.id) start 未递增")
                XCTAssertLessThanOrEqual(previousEnd, line.start + 0.001, "\(song.id)/\(line.id) 与上一行重叠")
                previousStart = line.start
                previousEnd = line.end

                XCTAssertEqual(
                    line.tokens.map(\.surface).joined(), line.text,
                    "\(song.id)/\(line.id) tokens 拼接与 text 不一致")
                for token in line.tokens {
                    if let reading = token.reading {
                        XCTAssertFalse(reading.isEmpty, "\(song.id)/\(line.id) 空 reading")
                    }
                }
            }
            XCTAssertLessThanOrEqual(
                song.lines.last!.end, song.durationSec - 2,
                "\(song.id) 末行超出歌曲时长")
        }
    }

    func testBundledAudioExistsAndMatchesDuration() throws {
        for song in SongLibrary.loadBundled() {
            let url = try XCTUnwrap(SongLibrary.audioURL(for: song), "\(song.id) 缺少音频")
            let player = try AVAudioPlayer(contentsOf: url)
            XCTAssertEqual(
                player.duration, song.durationSec, accuracy: 0.5,
                "\(song.id) 音频时长与 durationSec 不符")
        }
    }
}
