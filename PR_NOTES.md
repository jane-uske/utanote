# TTS asset pipeline notes

This branch adds a VOICEVOX-backed spoken Japanese TTS asset pipeline for UtaNote.

Core rule: playback and cache hits do not consume quota. Only cache misses that actually call the local VOICEVOX bridge consume generation quota.
