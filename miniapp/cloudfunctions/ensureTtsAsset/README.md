# ensureTtsAsset

Compatibility cloud function alias for the TTS asset pipeline.

It calls `generateLineTts` through `cloud.callFunction` and returns the same result. You can deploy it if you want the frontend/API name to read as `ensureTtsAsset`; otherwise the miniapp can continue calling `generateLineTts` directly.

Deploy both functions if you use this alias:

- `generateLineTts`
- `ensureTtsAsset`

Configure env vars only on `generateLineTts`; this alias does not call the local TTS service directly.
