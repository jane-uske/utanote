# Cache policy

`tts_cache` is global and must not include `openid`, `songId`, or `lineId` in its key. `song_tts_assets` binds that global audio file back to a specific song/card asset.
