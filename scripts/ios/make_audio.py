#!/usr/bin/env python3
"""UtaNote 演示歌曲伴奏合成器。

从歌曲 JSON 的 music 段（bpm + sections/chords）确定性地渲染一段温和的
lo-fi 伴奏（和声垫 + 分解和弦 + 贝斯 + 段落铃音 + 轻微黑胶底噪），
输出 44.1kHz 16bit 立体声 WAV，再用 macOS 自带 afconvert 转 AAC (.m4a)。

用法:
    python3 scripts/ios/make_audio.py <song.json ...> --out <m4a输出目录> [--wav-dir <目录>]
"""
import argparse
import json
import math
import os
import struct
import subprocess
import sys
import wave
import zlib
import random

SR = 44100

SEMITONE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
QUALITY = {
    "": (0, 4, 7),
    "m": (0, 3, 7),
    "7": (0, 4, 7, 10),
    "m7": (0, 3, 7, 10),
    "maj7": (0, 4, 7, 11),
    "sus4": (0, 5, 7),
}


def parse_chord(sym):
    root = SEMITONE[sym[0]]
    rest = sym[1:]
    if rest.startswith("#"):
        root += 1
        rest = rest[1:]
    elif rest.startswith("b"):
        root -= 1
        rest = rest[1:]
    return root % 12, QUALITY[rest]


def freq(semi, octave):
    midi = (octave + 1) * 12 + semi
    return 440.0 * 2 ** ((midi - 69) / 12)


def tone(f, dur, amp, harmonics, attack, tail, decay=None):
    """单音渲染: 谐波叠加 + ADSR-ish 包络, 返回 float 列表 (长度含 tail)。"""
    n = int((dur + tail) * SR)
    out = [0.0] * n
    for mult, hamp in harmonics:
        w = 2 * math.pi * f * mult / SR
        c, s = math.cos(w), math.sin(w)
        re, im = 1.0, 0.0
        a = amp * hamp
        for i in range(n):
            re, im = re * c - im * s, re * s + im * c
            out[i] += a * im
    inv_sr = 1.0 / SR
    for i in range(n):
        t = i * inv_sr
        env = math.exp(-t / decay) if decay else 1.0
        if t < attack:
            env *= t / attack
        if t > dur:
            env *= max(0.0, 1.0 - (t - dur) / tail) if tail > 0 else 0.0
        out[i] *= env
    return out


def add_into(dest, src, pos, gain):
    end = min(len(dest), pos + len(src))
    for i in range(pos, end):
        dest[i] += src[i - pos] * gain


class BarCache(dict):
    def get_or(self, key, fn):
        if key not in self:
            self[key] = fn()
        return self[key]


def render_song(song):
    music = song["music"]
    bpm = music["bpm"]
    barlen = 4 * 60.0 / bpm
    bars = [(sec["name"], i == 0, ch)
            for sec in music["sections"]
            for i, ch in enumerate(sec["chords"])]
    total = barlen * len(bars)
    n = int(total * SR) + SR
    left, right = [0.0] * n, [0.0] * n
    cache = BarCache()

    def pad_bar(sym):
        root, ivs = parse_chord(sym)
        buf = [0.0] * int((barlen + 0.7) * SR)
        for iv in ivs:
            f = freq(root + iv, 3 if iv == 0 else 4)
            add_into(buf, tone(f, barlen, 0.075, [(1, 1), (2, 0.45), (3, 0.15)],
                               attack=0.55, tail=0.6), 0, 1.0)
        return buf

    def bass_bar(sym):
        root, _ = parse_chord(sym)
        f = freq(root, 2)
        half = barlen / 2
        hit = tone(f, half * 0.85, 0.19, [(1, 1), (2, 0.22)],
                   attack=0.008, tail=0.15, decay=half * 0.7)
        buf = [0.0] * int((barlen + 0.4) * SR)
        add_into(buf, hit, 0, 1.0)
        add_into(buf, hit, int(half * SR), 0.85)
        return buf

    def arp_bar(sym):
        root, ivs = parse_chord(sym)
        tones = [freq(root + iv, 4) for iv in ivs[:3]] + [freq(root, 5)]
        pattern = [0, 1, 2, 1, 3, 2, 1, 2]
        eighth = barlen / 8
        buf = [0.0] * int((barlen + 0.4) * SR)
        for k, idx in enumerate(pattern):
            note = tone(tones[idx], eighth * 0.92, 0.10, [(1, 1), (2, 0.28)],
                        attack=0.004, tail=0.12, decay=0.30)
            add_into(buf, note, int(k * eighth * SR), 1.0)
        return buf

    def bell_bar(sym):
        root, _ = parse_chord(sym)
        return tone(freq(root, 5), min(2.2, barlen), 0.06,
                    [(1, 1), (2.76, 0.3)], attack=0.003, tail=0.9, decay=0.95)

    section_gain = {"intro": 0.8, "outro": 0.72}
    for b, (sec_name, is_sec_start, sym) in enumerate(bars):
        pos = int(b * barlen * SR)
        g = section_gain.get(sec_name, 1.0)
        chorus_lift = 1.06 if sec_name in ("chorus", "hook", "b") else 1.0
        pad = cache.get_or(("pad", sym), lambda: pad_bar(sym))
        add_into(left, pad, pos, 0.72 * g * chorus_lift)
        add_into(right, pad, pos, 0.72 * g * chorus_lift)
        bass = cache.get_or(("bass", sym), lambda: bass_bar(sym))
        add_into(left, bass, pos, 0.82 * g)
        add_into(right, bass, pos, 0.82 * g)
        arp = cache.get_or(("arp", sym), lambda: arp_bar(sym))
        arp_g = (0.55 if sec_name in ("intro", "outro") else 1.0) * chorus_lift
        add_into(left, arp, pos, 0.38 * arp_g)
        add_into(right, arp, pos, 0.78 * arp_g)
        if is_sec_start:
            bell = cache.get_or(("bell", sym), lambda: bell_bar(sym))
            add_into(left, bell, pos, 0.78)
            add_into(right, bell, pos, 0.36)

    # 轻微黑胶底噪（确定性）
    rng = random.Random(zlib.crc32(song["id"].encode()))
    y = 0.0
    for i in range(n):
        y += 0.06 * (rng.uniform(-1, 1) - y)
        v = y * 0.0035
        left[i] += v
        right[i] += v

    # 淡入淡出 + 软限幅 + 归一化
    fade_in = int(0.8 * SR)
    fade_out = int(2.5 * SR)
    end = int(total * SR)
    for ch in (left, right):
        for i in range(fade_in):
            g = i / fade_in
            ch[i] *= g
        for i in range(fade_out):
            idx = end - fade_out + i
            if 0 <= idx < n:
                ch[idx] *= 1.0 - i / fade_out
        for i in range(end, n):
            ch[i] = 0.0
    peak = max(max(abs(v) for v in left), max(abs(v) for v in right), 1e-9)
    norm = 0.89 / peak if peak > 0.89 else 1.0
    frames = bytearray()
    for i in range(end):
        l = math.tanh(left[i] * norm * 1.1)
        r = math.tanh(right[i] * norm * 1.1)
        frames += struct.pack("<hh", int(l * 32767), int(r * 32767))
    return frames, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("songs", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--wav-dir", default=None)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    wav_dir = args.wav_dir or args.out
    os.makedirs(wav_dir, exist_ok=True)

    for path in args.songs:
        with open(path, encoding="utf-8") as f:
            song = json.load(f)
        sid = song["id"]
        print(f"[{sid}] rendering ...", flush=True)
        frames, total = render_song(song)
        wav_path = os.path.join(wav_dir, f"{sid}.wav")
        with wave.open(wav_path, "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(bytes(frames))
        m4a_path = os.path.join(args.out, f"{sid}.m4a")
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "96000",
                        wav_path, m4a_path], check=True)
        expect = song.get("durationSec", 0)
        print(f"[{sid}] done: {total:.2f}s (json 声称 {expect}s) -> {m4a_path}", flush=True)
        if abs(total - expect) > 0.2:
            print(f"[{sid}] ERROR: 时长与 durationSec 不符", flush=True)
            sys.exit(1)


if __name__ == "__main__":
    main()
