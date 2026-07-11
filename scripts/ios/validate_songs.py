#!/usr/bin/env python3
"""UtaNote 歌曲内容包校验器。用法:
    python3 scripts/ios/validate_songs.py <song.json> [more.json ...]
退出码 0 = 全部通过。错误信息面向内容作者, 逐条列出。"""
import json
import re
import sys

EMOTIONS = {"warm", "nostalgic", "hopeful", "melancholic", "tender", "longing",
            "bright", "bittersweet", "quiet", "resolute"}
LEVELS = {"N5", "N4", "N3", "N2", "N1"}
CHORD_RE = re.compile(r"^[A-G][#b]?(m7|maj7|m|7|sus4)?$")
HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

KANJI = lambda ch: "一" <= ch <= "鿿" or ch == "々"
HIRA = lambda ch: "ぁ" <= ch <= "ゖ" or ch == "ー"


def is_hira_only(s):
    return len(s) > 0 and all(HIRA(c) for c in s)


def has_kanji(s):
    return any(KANJI(c) for c in s)


def section_seconds(sec, bpm):
    return sec["bars"] * 4 * 60.0 / bpm


def validate(path):
    errs, warns = [], []
    e = errs.append
    try:
        with open(path, encoding="utf-8") as f:
            song = json.load(f)
    except Exception as ex:
        return [f"JSON 解析失败: {ex}"], []

    for key in ("id", "order", "title", "titleReading", "titleTranslation", "artist",
                "level", "summary", "storyIntro", "tags", "coverStyle", "music",
                "durationSec", "lines"):
        if key not in song:
            e(f"缺少顶层字段 {key}")
    if errs:
        return errs, warns

    if song["level"] not in LEVELS:
        e(f"level 非法: {song['level']}")
    if not (2 <= len(song["tags"]) <= 4):
        e("tags 需要 2–4 个")
    if not is_hira_only(song["titleReading"].replace("　", "").replace(" ", "")):
        e("titleReading 只能是平假名")

    cs = song["coverStyle"]
    if len(cs.get("glyph", "")) != 1:
        e("coverStyle.glyph 必须是单个字符")
    if len(cs.get("colors", [])) != 2 or not all(HEX_RE.match(c) for c in cs["colors"]):
        e("coverStyle.colors 必须是 2 个 #RRGGBB")
    if not HEX_RE.match(cs.get("accentHex", "")):
        e("coverStyle.accentHex 必须是 #RRGGBB")

    music = song["music"]
    bpm = music.get("bpm", 0)
    sections = music.get("sections", [])
    if not (40 <= bpm <= 160):
        e(f"bpm 异常: {bpm}")
    total = 0.0
    for s in sections:
        if len(s.get("chords", [])) != s.get("bars", -1):
            e(f"section {s.get('name')} 的 chords 数量必须等于 bars")
        for c in s.get("chords", []):
            if not CHORD_RE.match(c):
                e(f"和弦不受支持: {c} (允许: 大三/m/7/m7/maj7/sus4, 可带#或b)")
        total += section_seconds(s, bpm) if bpm else 0
    if bpm and abs(total - song["durationSec"]) > 0.1:
        e(f"durationSec={song['durationSec']} 与 music 推算 {total:.2f} 不符")
    intro = section_seconds(sections[0], bpm) if sections and bpm and sections[0].get("name") == "intro" else 0.0

    lines = song["lines"]
    if not (12 <= len(lines) <= 15):
        e(f"行数 {len(lines)} 不在 12–15")
    seen_ids, seen_grammar = set(), set()
    n_words = n_grammar = 0
    prev_end, prev_start = -1.0, -1.0
    for i, ln in enumerate(lines):
        tag = f"line[{i}] ({ln.get('id', '?')})"
        for key in ("id", "start", "end", "text", "tokens", "translation", "words",
                    "grammar", "emotion", "culture", "singingTip"):
            if key not in ln:
                e(f"{tag}: 缺少字段 {key}")
        if errs:
            continue
        if ln["id"] in seen_ids:
            e(f"{tag}: id 重复")
        seen_ids.add(ln["id"])

        st, en, text = ln["start"], ln["end"], ln["text"]
        dur = en - st
        if st >= en:
            e(f"{tag}: start >= end")
        if not (2.5 <= dur <= 9.5):
            e(f"{tag}: 时长 {dur:.1f}s 不在 2.5–9.5s")
        if st <= prev_start:
            e(f"{tag}: start 未严格递增")
        if prev_end > st + 1e-6:
            e(f"{tag}: 与上一行时间重叠 (上一行 end={prev_end})")
        prev_start, prev_end = st, en
        if i == 0 and st < intro - 1.5:
            e(f"{tag}: 首行 start={st} 早于前奏结束 {intro:.1f}s")
        if i == len(lines) - 1 and en > song["durationSec"] - 3:
            e(f"{tag}: 末行 end={en} 超过 durationSec-3")

        if len(text) > 22:
            e(f"{tag}: text 超过 22 字符")
        if re.search(r"[A-Za-z]", text):
            e(f"{tag}: text 不应含 ASCII 字母")
        joined = "".join(t["surface"] for t in ln["tokens"])
        if joined != text:
            e(f"{tag}: tokens 拼接 ≠ text: {joined!r} vs {text!r}")
        for t in ln["tokens"]:
            surf, rd = t["surface"], t.get("reading")
            if has_kanji(surf):
                if not rd or not is_hira_only(rd):
                    e(f"{tag}: token「{surf}」含汉字, reading 必须是平假名, 现为 {rd!r}")
            else:
                if rd is not None:
                    e(f"{tag}: token「{surf}」不含汉字, reading 应为 null")

        if len(ln["words"]) > 4:
            e(f"{tag}: words 最多 4 个")
        for w in ln["words"]:
            n_words += 1
            if w.get("level") not in LEVELS:
                e(f"{tag}: word「{w.get('surface')}」level 非法")
            for k in ("surface", "reading", "meaning"):
                if not w.get(k):
                    e(f"{tag}: word 缺少 {k}")
        if len(ln["grammar"]) > 2:
            e(f"{tag}: grammar 最多 2 个")
        for g in ln["grammar"]:
            n_grammar += 1
            for k in ("pattern", "explanation", "example", "exampleTranslation"):
                if not g.get(k):
                    e(f"{tag}: grammar 缺少 {k}")
            if g.get("pattern") in seen_grammar:
                e(f"{tag}: 语法点「{g['pattern']}」重复讲解")
            seen_grammar.add(g.get("pattern"))
            if g.get("example") and g["example"] in text:
                warns.append(f"{tag}: 语法例句直接复用了本句歌词")

        emo = ln["emotion"]
        if emo.get("kind") not in EMOTIONS:
            e(f"{tag}: emotion.kind 非法: {emo.get('kind')}")
        if not (0 <= emo.get("intensity", -1) <= 1):
            e(f"{tag}: emotion.intensity 必须 0–1")
        if not emo.get("note"):
            e(f"{tag}: emotion.note 不能为空")

    if n_words < 18:
        e(f"全曲 words 总数 {n_words} < 18")
    if n_grammar < 8:
        e(f"全曲 grammar 总数 {n_grammar} < 8")
    n_culture = sum(1 for ln in lines if ln.get("culture"))
    n_tip = sum(1 for ln in lines if ln.get("singingTip"))
    if n_culture < 2:
        warns.append(f"culture 只有 {n_culture} 处, 建议 2–4 处")
    if n_tip < 3:
        warns.append(f"singingTip 只有 {n_tip} 处, 建议 3–5 处")
    return errs, warns


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    failed = False
    for path in sys.argv[1:]:
        errs, warns = validate(path)
        status = "FAIL" if errs else "PASS"
        print(f"[{status}] {path}")
        for msg in errs:
            print(f"  ERROR: {msg}")
        for msg in warns:
            print(f"  warn : {msg}")
        failed = failed or bool(errs)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
