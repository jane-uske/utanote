import Foundation

/// 设备端日文分词 + 假名注音：把用户贴入的歌词行变成可注音的 tokens。
/// 质量取决于系统词法分析（CFStringTokenizer），偶有误读——UI 应标注「自动注音」。
enum JapaneseAnnotator {
    /// 一行日文 → tokens。仅含汉字的 token 给假名 reading，与内容包 schema 语义一致。
    static func tokens(for text: String) -> [Token] {
        guard !text.isEmpty else { return [] }
        let cfText = text as CFString
        let length = CFStringGetLength(cfText)
        guard let tokenizer = CFStringTokenizerCreate(
            kCFAllocatorDefault, cfText,
            CFRangeMake(0, length),
            kCFStringTokenizerUnitWordBoundary,
            Locale(identifier: "ja_JP") as CFLocale)
        else {
            return [Token(surface: text, reading: nil)]
        }

        var tokens: [Token] = []
        var cursor = 0
        let nsText = text as NSString

        while CFStringTokenizerAdvanceToNextToken(tokenizer) != [] {
            let range = CFStringTokenizerGetCurrentTokenRange(tokenizer)
            // 词法分析可能跳过空白/符号：把间隙原样补回，保证拼接 == 原文
            if range.location > cursor {
                let gap = nsText.substring(with: NSRange(location: cursor, length: range.location - cursor))
                tokens.append(Token(surface: gap, reading: nil))
            }
            let surface = nsText.substring(with: NSRange(location: range.location, length: range.length))
            tokens.append(Token(surface: surface, reading: reading(for: surface, tokenizer: tokenizer)))
            cursor = range.location + range.length
        }
        if cursor < length {
            tokens.append(Token(surface: nsText.substring(from: cursor), reading: nil))
        }
        return tokens
    }

    /// 含汉字的词取假名读音（Latin 转写 → 平假名）；纯假名/符号返回 nil
    private static func reading(for surface: String, tokenizer: CFStringTokenizer) -> String? {
        guard surface.unicodeScalars.contains(where: isKanji) else { return nil }
        guard let latin = CFStringTokenizerCopyCurrentTokenAttribute(
            tokenizer, kCFStringTokenizerAttributeLatinTranscription) as? String, !latin.isEmpty
        else { return nil }
        let mutable = NSMutableString(string: latin)
        CFStringTransform(mutable, nil, kCFStringTransformLatinHiragana, false)
        let kana = mutable as String
        // 转写失败（仍是拉丁字符）时不硬给错误注音
        return kana.unicodeScalars.contains(where: { $0.isASCII }) ? nil : kana
    }

    private static func isKanji(_ scalar: Unicode.Scalar) -> Bool {
        (0x4E00...0x9FFF).contains(scalar.value) || (0x3400...0x4DBF).contains(scalar.value)
            || scalar.value == 0x3005  // 々
    }
}
