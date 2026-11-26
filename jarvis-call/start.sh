#!/usr/bin/env bash
# Jalanin server telpon + tunnel cloudflared sekaligus. Ctrl+C buat berhenti dua-duanya.
set -Eeuo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-7860}"
LOG_DIR=".logs"
mkdir -p "$LOG_DIR"

die() { echo "❌ $*" >&2; exit 1; }

[ -f .env ] || die ".env belum ada. Jalanin: cp .env.example .env lalu isi nilainya."
command -v cloudflared >/dev/null 2>&1 || die "cloudflared belum keinstall. Mac: brew install cloudflared"

if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
else
  echo "⚠️  Folder .venv gak ada — pakai Python sistem. Disarankan: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
fi
python -c "import pipecat, fastapi" 2>/dev/null || die "Dependensi belum lengkap. Jalanin: pip install -r requirements.txt"

if command -v lsof >/dev/null 2>&1 && lsof -nPi :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  die "Port $PORT sudah dipakai proses lain. Hentikan dulu, atau jalanin: PORT=7861 ./start.sh"
fi

SERVER_PID=""
TUNNEL_PID=""
cleanup() {
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

python server.py --port "$PORT" &
SERVER_PID=$!

# tunggu server siap sebelum tunnel dibuka
for _ in $(seq 1 30); do
  kill -0 "$SERVER_PID" 2>/dev/null || die "server.py mati saat start — cek pesan error di atas."
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

TUNNEL_LOG="$LOG_DIR/cloudflared.log"
if [ -n "${CLOUDFLARE_TUNNEL_NAME:-}" ]; then
  # tunnel bernama = domain tetap (disarankan, URL webhook gak berubah-ubah)
  cloudflared tunnel run "$CLOUDFLARE_TUNNEL_NAME" 2>&1 | tee "$TUNNEL_LOG" &
  TUNNEL_PID=$!
  echo "🌐 Tunnel bernama '$CLOUDFLARE_TUNNEL_NAME' jalan. Webhook: https://<domain-tunnel>/whatsapp"
else
  # quick tunnel = URL acak *.trycloudflare.com, ganti tiap restart
  cloudflared tunnel --url "http://localhost:$PORT" 2>&1 | tee "$TUNNEL_LOG" &
  TUNNEL_PID=$!
  (
    for _ in $(seq 1 40); do
      URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)
      if [ -n "$URL" ]; then
        echo ""
        echo "🌐 Webhook URL buat Meta:  $URL/whatsapp"
        echo "   Verify token: isi sama dengan WHATSAPP_WEBHOOK_VERIFICATION_TOKEN di .env"
        echo ""
        exit 0
      fi
      sleep 1
    done
  ) &
fi

wait "$SERVER_PID"
