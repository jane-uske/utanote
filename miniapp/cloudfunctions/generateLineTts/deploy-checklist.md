# Deploy checklist

1. Create CloudBase collections: `tts_cache`, `song_tts_assets`, `tts_usage_daily`, `tts_usage_global_daily`.
2. Deploy `generateLineTts` with npm dependencies.
3. Configure `UTANOTE_TTS_ENDPOINT` and `UTANOTE_TTS_TOKEN` on `generateLineTts`.
4. Start VOICEVOX Engine locally.
5. Start `services/local-tts-server`.
6. Start cloudflared tunnel.
7. Tap a line in the miniapp twice. The first tap may generate; the second should hit cache.
