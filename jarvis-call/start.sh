#!/usr/bin/env bash
# Jalanin server telpon + tunnel cloudflared sekaligus. Ctrl+C buat berhenti dua-duanya.
set -e
cd "$(dirname "$0")"
PORT="${PORT:-7860}"
[ -d .venv ] && source .venv/bin/activate

python server.py --port "$PORT" &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

if [ -n "$CLOUDFLARE_TUNNEL_NAME" ]; then
  # tunnel bernama = domain tetap (disarankan, URL webhook gak berubah-ubah)
  cloudflared tunnel run "$CLOUDFLARE_TUNNEL_NAME"
else
  # quick tunnel = URL acak *.trycloudflare.com, ganti tiap restart
  cloudflared tunnel --url "http://localhost:$PORT"
fi
