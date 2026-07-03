# UtaNote local TTS server

Private bridge from WeChat cloud functions to a local VOICEVOX Engine running on your Mac.

This service is intentionally not called by the mini program directly. The mini program calls the `generateLineTts` cloud function, and that cloud function calls this server through your Cloudflare Tunnel hostname with `X-UtaNote-Token`.

## Prerequisites

- Node.js 18+
- `ffmpeg` available in PATH
- VOICEVOX Engine listening on `http://127.0.0.1:50021`
- `cloudflared` tunnel mapped to this service, for example `tts.example.com -> http://localhost:8787`

## Start

```bash
cd services/local-tts-server
export UTANOTE_TTS_TOKEN='replace-with-a-long-random-token'
export VOICEVOX_ENDPOINT='http://127.0.0.1:50021'
export VOICEVOX_DEFAULT_SPEAKER=16
export MAX_TTS_CONCURRENCY=1
npm start
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

Generate a short line:

```bash
curl -X POST http://127.0.0.1:8787/internal/jp-tts \
  -H 'Content-Type: application/json' \
  -H "X-UtaNote-Token: $UTANOTE_TTS_TOKEN" \
  -d '{"text":"夜風が静かに窓をたたく","speaker":16,"speedScale":0.9}'
```

## Cloud function env

Configure these env vars on the WeChat cloud function `generateLineTts`:

```bash
UTANOTE_TTS_ENDPOINT=https://tts.example.com
UTANOTE_TTS_TOKEN=replace-with-the-same-token
TEXT_MAX_LENGTH=120
DAILY_USER_ASSET_GENERATE_LIMIT=300
DAILY_CUSTOM_TEXT_GENERATE_LIMIT=100
GLOBAL_DAILY_TTS_GENERATE_LIMIT=3000
TTS_REQUEST_TIMEOUT_MS=15000
VOICEVOX_ENGINE_VERSION=voicevox-v1
```

## Cloudflare Tunnel example

```yaml
ingress:
  - hostname: tts.example.com
    service: http://localhost:8787
  - service: http_status:404
```

Keep `UTANOTE_TTS_TOKEN` out of mini program frontend code. Only the cloud function should know it.
