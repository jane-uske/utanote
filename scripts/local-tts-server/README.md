# UtaNote Local TTS Server

Local bridge from the WeChat cloud function to VOICEVOX Engine.

## Start

```bash
cd scripts/local-tts-server
export UTANOTE_TTS_TOKEN="replace-with-a-long-random-token"
export UTANOTE_TTS_PORT=8787
export VOICEVOX_ENGINE_URL="http://127.0.0.1:50021"
npm start
```

VOICEVOX Engine and `ffmpeg` must already be available on this Mac.

## Health Check

```bash
curl http://127.0.0.1:8787/health
```

## Generate One Line

```bash
curl -X POST http://127.0.0.1:8787/internal/jp-tts \
  -H "Content-Type: application/json" \
  -H "X-UtaNote-Token: $UTANOTE_TTS_TOKEN" \
  -d '{"text":"君がいた夏の日","speaker":2,"speedScale":0.9}'
```

Expose it through cloudflared, for example:

```yaml
ingress:
  - hostname: tts.example.com
    service: http://localhost:8787
  - service: http_status:404
```

Put only the public HTTPS endpoint and token in the `generateLineTts` cloud
function environment variables:

```text
UTANOTE_TTS_ENDPOINT=https://tts.example.com
UTANOTE_TTS_TOKEN=replace-with-the-same-token
```
