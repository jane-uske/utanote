# UtaNote iOS 歌曲内容包 Schema（v1）

每首歌一个 JSON 文件，放在 `ios/UtaNote/Resources/Songs/<id>.json`，UTF-8 无 BOM。
写完必须跑校验器直到通过：

```bash
python3 scripts/ios/validate_songs.py ios/UtaNote/Resources/Songs/<id>.json
```

## 顶层字段（全部必填，除非标注 optional）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | kebab-case，与文件名一致 |
| `order` | int | 曲库排序，1 起 |
| `title` | string | 日文歌名 |
| `titleReading` | string | 歌名平假名读音 |
| `titleTranslation` | string | 中文歌名 |
| `artist` | string | 虚构歌手名（日文） |
| `level` | string | 主难度："N5" / "N4" / "N3" |
| `summary` | string | 一句话中文简介（≤30字） |
| `storyIntro` | string | 2–3 句中文歌曲故事/情境介绍 |
| `tags` | string[] | 2–4 个日文标签，如 "バラード" "夜" |
| `coverStyle` | object | `{ "glyph": "月", "colors": ["#RRGGBB", "#RRGGBB"], "accentHex": "#RRGGBB" }`，glyph 为单个汉字 |
| `music` | object | 由任务下发，**逐字节原样复制，不得改动** |
| `durationSec` | number | 由任务下发，等于 music 推算时长 |
| `lines` | object[] | 歌词行，12–15 行 |

## line 对象

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | `"l01"`、`"l02"`… 递增唯一 |
| `start` / `end` | number | 秒，一位小数即可。行间可以留空隙 |
| `text` | string | 该句歌词原文 |
| `tokens` | object[] | 分词，`{"surface": "...", "reading": "..."\|null}` |
| `translation` | string | 自然的中文翻译（不是直译腔） |
| `words` | object[] | 0–4 个重点词 `{"surface","reading","meaning","level","note"(optional)}`，meaning/note 为中文，level 为 N5–N1 |
| `grammar` | object[] | 0–2 个语法点 `{"pattern","explanation","example","exampleTranslation"}`，explanation 中文，example 为**不同于本句**的日文新例句 |
| `emotion` | object | `{"kind": <enum>, "intensity": 0–1, "note": "中文一句话"}` |
| `culture` | string\|null | 文化/语感背景（中文），大多数行为 null，每首歌 2–4 行有 |
| `singingTip` | string\|null | 唱法/发音提示（中文），每首歌 3–5 行有 |

`emotion.kind` 枚举：`warm, nostalgic, hopeful, melancholic, tender, longing, bright, bittersweet, quiet, resolute`

## 硬性规则（校验器逐条检查）

1. **tokens 的 surface 依序拼接必须与 text 逐字符相等**（空格、标点也要成为独立 token）。
2. token 含汉字（含「々」）→ `reading` 必填且只能是平假名+「ー」；纯假名/标点/空格 token → `reading` 必须为 `null`。
3. 行时间：`start < end`，时长 2.5–9.5 秒；各行 `start` 严格递增且 `end ≤ 下一行 start`；首行 `start ≥ 前奏结束-1.5s`；末行 `end ≤ durationSec - 3`。
4. 行数 12–15；每行 text ≤ 22 字符；不使用 ASCII 字母（不写罗马字歌词）。
5. 全曲 words 总数 ≥ 18，grammar 总数 ≥ 8，且不重复讲同一个语法点。
6. `music`、`durationSec` 与任务下发内容完全一致。

## 内容质量要求（校验器查不了，但同样是验收标准）

- 歌词是**自然、可唱的日语**，音节数贴合旋律速度（慢歌每行 8–14 拍内），意象具体，避免教材腔。
- 难度贴合 `level`：N5 歌用 N5–N4 词汇语法为主，偶有超纲词就放进 words 讲解。
- 翻译像歌词集里的中文译文，信达雅，不逐字对译。
- 语法解释写给中文母语学习者：一句讲清接续+含义，例句要新造、简单、贴日常。
- emotion/culture/singingTip 要具体到"这一句"，不写空话。

## 最小示例（两行，仅示意格式）

```json
{
  "id": "demo",
  "order": 1,
  "title": "夜の手紙",
  "titleReading": "よるのてがみ",
  "titleTranslation": "夜的信",
  "artist": "白瀬まひろ",
  "level": "N5",
  "summary": "深夜写给远方之人的一封信。",
  "storyIntro": "……",
  "tags": ["バラード", "夜"],
  "coverStyle": { "glyph": "月", "colors": ["#2B3A55", "#8A7A66"], "accentHex": "#8FA0BE" },
  "music": { "bpm": 72, "sections": [ { "name": "intro", "bars": 4, "chords": ["Am", "F", "C", "G"] } ] },
  "durationSec": 13.33,
  "lines": [
    {
      "id": "l01",
      "start": 13.5,
      "end": 18.6,
      "text": "夜の窓に 灯りがともる",
      "tokens": [
        { "surface": "夜", "reading": "よる" },
        { "surface": "の", "reading": null },
        { "surface": "窓", "reading": "まど" },
        { "surface": "に", "reading": null },
        { "surface": " ", "reading": null },
        { "surface": "灯り", "reading": "あかり" },
        { "surface": "が", "reading": null },
        { "surface": "ともる", "reading": null }
      ],
      "translation": "夜色里，窗边的灯亮了起来",
      "words": [
        { "surface": "灯り", "reading": "あかり", "meaning": "灯光、亮光", "level": "N4", "note": "比「電気」更有温度的说法，常见于歌词。" }
      ],
      "grammar": [
        { "pattern": "〜がともる", "explanation": "「ともる」是自动词，表示灯火自然点亮，主语用「が」。", "example": "街に明かりがともった。", "exampleTranslation": "街上亮起了灯火。" }
      ],
      "emotion": { "kind": "quiet", "intensity": 0.5, "note": "夜晚安静的开场，一盏灯是唯一的动静。" },
      "culture": null,
      "singingTip": "「ともる」的「と」轻轻起音，不要重读。"
    }
  ]
}
```
