#!/usr/bin/env bash
# UtaNote 本地 TTS 自检 / 启动脚本 —— 电脑重启后跑这一条就行。
#
# TTS 依赖 3 个「本地」服务（云端 generateLineTts / 集合是持久的，不用管）：
#   1. VOICEVOX Engine   —— :50021（打开 VOICEVOX App）
#   2. local-tts-server  —— :8787（本脚本会自动起）
#   3. cloudflared 隧道  —— tts.remi.run → localhost:8787（你的 cloudflared 配置）
#
# 用法：  bash scripts/local-tts-server/start-tts.sh
set -uo pipefail
cd "$(dirname "$0")"

# 读本地密钥配置（.env.local 不入库；没有就用环境变量/默认）
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
: "${VOICEVOX_ENGINE_URL:=http://127.0.0.1:50021}"
: "${MAX_TTS_CONCURRENCY:=1}"
PORT="${PORT:-8787}"

echo "==== UtaNote 本地 TTS 自检 ===="

# 1) VOICEVOX
if ver=$(curl -s -m 3 "$VOICEVOX_ENGINE_URL/version" 2>/dev/null); then
  echo "✅ VOICEVOX 在跑（$ver）"
else
  echo "❌ VOICEVOX 没起 → 打开「VOICEVOX」App（或 open -a VOICEVOX），等它监听 :50021 再重跑本脚本"
fi

# 2) local-tts-server
if curl -s -m 3 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "✅ local-tts-server 已在 :$PORT（$(curl -s -m3 http://127.0.0.1:$PORT/health)）"
elif [ -z "${UTANOTE_TTS_TOKEN:-}" ]; then
  echo "❌ 缺 UTANOTE_TTS_TOKEN（在 scripts/local-tts-server/.env.local 里配），未启动"
else
  UTANOTE_TTS_TOKEN="$UTANOTE_TTS_TOKEN" VOICEVOX_ENGINE_URL="$VOICEVOX_ENGINE_URL" MAX_TTS_CONCURRENCY="$MAX_TTS_CONCURRENCY" \
    nohup node server.js > /tmp/utanote-local-tts.log 2>&1 </dev/null & disown
  SRVPID=$!
  if curl -s --retry 8 --retry-connrefused --retry-delay 1 -m 5 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    echo "✅ local-tts-server 已启动（PID $SRVPID，日志 /tmp/utanote-local-tts.log）"
  else
    echo "❌ local-tts-server 启动失败 → 看 /tmp/utanote-local-tts.log"
  fi
fi

# 3) cloudflared 隧道
if curl -s -m 6 https://tts.remi.run/health >/dev/null 2>&1; then
  echo "✅ 隧道 tts.remi.run 通"
else
  echo "❌ 隧道不通 → 起你的 cloudflared（tts.remi.run → localhost:$PORT）"
fi

echo "================================"
echo "三个都 ✅ 后：微信开发者工具打开小程序 → 学习卡片 → 点朗读即可。"
