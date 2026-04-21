#!/usr/bin/env bash
# Oracle Cloud Always Free ARM VM — one-shot setup for CIES.
# Run as the ubuntu user (not root). Uses sudo where needed.
# Re-running is safe: Docker install is skipped if already present,
# git pull fast-forwards, and systemd service is reloaded.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/marcoaiwithfefe-hub/CIES-SaaS.git}"
APP_DIR="${APP_DIR:-/opt/cies}"
DATA_DIR="${DATA_DIR:-/data}"
TUNNEL_NAME="${TUNNEL_NAME:-cies}"

echo "==> Installing Docker (skipped if already installed)"
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu jammy stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
  sudo usermod -aG docker "$USER"
  echo ""
  echo "==> Docker installed. Log out and back in to pick up the docker group, then re-run this script."
  exit 0
fi

echo "==> Preparing data directories"
sudo mkdir -p "$APP_DIR" "$DATA_DIR/captures" "$DATA_DIR/logs"
sudo chown -R "$USER:$USER" "$APP_DIR" "$DATA_DIR"

echo "==> Cloning or updating repo"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

echo "==> Building Docker image"
cd "$APP_DIR"
docker build -t cies:latest .

echo "==> Writing .env (preserves existing INTERNAL_API_SECRET if present)"
if [ ! -f "$APP_DIR/.env" ]; then
  RAND_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 40)"
  cat > "$APP_DIR/.env" <<EOF
INTERNAL_API_SECRET=${RAND_SECRET}
CIES_DATA_DIR=${DATA_DIR}
NODE_ENV=production
# Set CIES_SELF_PING_URL to your public URL + /api/health after DNS is live:
# CIES_SELF_PING_URL=https://cies.example.com/api/health
EOF
  echo "==> .env created with fresh secret"
else
  echo "==> .env already exists — not overwritten"
fi

echo "==> Writing systemd service"
sudo tee /etc/systemd/system/cies.service >/dev/null <<UNIT
[Unit]
Description=CIES Screenshot Tool
After=docker.service
Requires=docker.service

[Service]
Restart=always
ExecStartPre=-/usr/bin/docker rm -f cies
ExecStart=/usr/bin/docker run --rm --name cies \
  -p 127.0.0.1:3000:3000 \
  -v ${DATA_DIR}:/data \
  --env-file ${APP_DIR}/.env \
  cies:latest
ExecStop=/usr/bin/docker stop cies

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now cies.service
echo "==> cies.service enabled and started"

echo "==> Installing cloudflared (skipped if already installed)"
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -L -o /tmp/cloudflared.deb \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  sudo dpkg -i /tmp/cloudflared.deb
  echo "==> cloudflared installed"
fi

echo ""
echo "==> Setup complete. Next steps (run manually once DNS is ready):"
echo "  1) cloudflared tunnel login"
echo "  2) cloudflared tunnel create ${TUNNEL_NAME}"
echo "  3) cloudflared tunnel route dns ${TUNNEL_NAME} <your-hostname>"
echo "     (or test with: cloudflared tunnel --url http://127.0.0.1:3000)"
echo "  4) Add CIES_SELF_PING_URL to ${APP_DIR}/.env, then:"
echo "     sudo systemctl restart cies"
echo ""
echo "==> Tail logs with: journalctl -u cies -f"
echo "==> Health check:   curl http://127.0.0.1:3000/api/health"
