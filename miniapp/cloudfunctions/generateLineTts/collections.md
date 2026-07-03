# TTS collections

Create these CloudBase collections before testing TTS.

## tts_cache

Global audio cache. Same text + voice + speed + engine version reuses one cloud file.

Suggested permission for early testing: cloud function readable/writable, frontend not directly writable.

## song_tts_assets

Per-song/per-card asset binding. This maps a learning asset such as `songId + lineId + sentence_normal` to a cached `fileID`.

## tts_usage_daily

Per-user counters:

- `uploadSongCount`
- `generatedAssetCount`
- `customTextGenerateCount`

## tts_usage_global_daily

Global generated audio counter used to protect the local Mac TTS worker.
