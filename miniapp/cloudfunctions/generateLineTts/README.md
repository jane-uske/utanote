# generateLineTts

Ensures a spoken Japanese TTS learning asset exists and returns a WeChat cloud storage `fileID`.

## Important behavior

- Playback does not call this function if the miniapp already has a local/cloud audio source.
- `song_tts_assets` hit: returns existing `fileID`, no quota consumed.
- `tts_cache` hit: binds the global cached audio to this song/card asset, no quota consumed.
- Cache miss: calls the private local TTS server through `UTANOTE_TTS_ENDPOINT`, uploads the audio to cloud storage, then writes `tts_cache` and `song_tts_assets`.
- `platform_card` and `whitelist_song` do not consume user quota, but still consume global generation quota.
- `user_uploaded_song` consumes `generatedAssetCount` only on real synthesis.
- `user_custom_text` consumes `customTextGenerateCount` only on real synthesis.

## Collections

Create these collections in CloudBase:

- `tts_cache`
- `song_tts_assets`
- `tts_usage_daily`
- `tts_usage_global_daily`

## Environment variables

```bash
UTANOTE_TTS_ENDPOINT=https://tts.example.com
UTANOTE_TTS_TOKEN=replace-with-long-random-token
TEXT_MAX_LENGTH=120
DAILY_USER_ASSET_GENERATE_LIMIT=300
DAILY_CUSTOM_TEXT_GENERATE_LIMIT=100
GLOBAL_DAILY_TTS_GENERATE_LIMIT=3000
TTS_REQUEST_TIMEOUT_MS=15000
VOICEVOX_ENGINE_VERSION=voicevox-v1
```

## Example request

```js
wx.cloud.callFunction({
  name: 'generateLineTts',
  data: {
    source: 'user_uploaded_song',
    songId: 'song-xxx',
    lineId: '01',
    assetType: 'sentence_normal',
    text: '夜風が静かに 窓をたたく',
    voice: 'voicevox_sora_normal',
    speedScale: 0.9,
  },
})
```

## Particle chunks

For grammar particles, pass `displayText` as UI text and `audioText` as the useful spoken phrase in the miniapp layer. Example:

```js
{
  assetType: 'chunk',
  chunkKey: 'particle-wo',
  text: 'を',
  audioText: '窓を'
}
```
