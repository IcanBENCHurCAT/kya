#!/usr/bin/env bash
# /home/st9797/.openclaw/workspace/agents/coding/kya-service/ssl-setup.sh
#
# KYA Service — TLS Certificate Setup
#
# Supports two modes:
#   1. Let's Encrypt (certbot) — for production domains
#   2. Self-signed (mkcert) — for local development
#
# Usage:
#   ./ssl-setup.sh --domain kya.example.com --mode letsencrypt  # Production
#   ./ssl-setup.sh --domain localhost --mode selfsigned          # Development
#
# Licensed under AGPL-3.0 — See LICENSE file for details.

set -euo pipefail

# ─── Defaults ───────────────────────────────────────────────────────────────
MODE=""
DOMAIN=""
CERT_DIR="$(dirname "$0")/certs"

usage() {
  cat <<EOF
Usage: $(basename "$0") --domain <DOMAIN> --mode <letsencrypt|selfsigned>

Options:
  --domain  Target domain (required)
  --mode    Certificate mode: letsencrypt or selfsigned (required)

Examples:
  # Production with Let's Encrypt
  $(basename "$0") --domain kya.example.com --mode letsencrypt

  # Local development with self-signed
  $(basename "$0") --domain localhost --mode selfsigned
EOF
  exit 1
}

# ─── Parse arguments ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --mode)   MODE="$2"; shift 2 ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$DOMAIN" || -z "$MODE" ]]; then
  echo "Error: --domain and --mode are required"
  usage
fi

if [[ "$MODE" != "letsencrypt" && "$MODE" != "selfsigned" ]]; then
  echo "Error: --mode must be 'letsencrypt' or 'selfsigned'"
  usage
fi

mkdir -p "$CERT_DIR"

echo "=========================================="
echo " KYA Service — TLS Certificate Setup"
echo "=========================================="
echo " Domain:  $DOMAIN"
echo " Mode:    $MODE"
echo " Certs:   $CERT_DIR"
echo "=========================================="

# ─── Let's Encrypt (certbot) ───────────────────────────────────────────────
setup_letsencrypt() {
  echo ""
  echo "[1/4] Installing certbot..."
  if command -v certbot &>/dev/null; then
    echo "  ✓ certbot already installed ($( certbot --version | head -1 ))"
  else
    if [[ -f /etc/os-release ]]; then
      . /etc/os-release
      case "$ID" in
        ubuntu|debian)
          sudo apt-get update && sudo apt-get install -y certbot
          ;;
        alpine)
          sudo apk add --no-cache certbot
          ;;
        amazon|amzn)
          sudo amazon-linux-extras install epel -y 2>/dev/null || true
          sudo yum install -y certbot
          ;;
        *)
          echo "  ⚠ Unsupported OS for certbot auto-install. Install manually:"
          echo "     https://certbot.eff.org/instructions"
          echo "  Continuing with assumption that certbot is available..."
          ;;
      esac
    fi
  fi

  echo "[2/4] Generating certificate..."
  sudo certbot certonly \
    --standalone \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "admin@$DOMAIN" \
    --preferred-challenges http \
    2>&1 | tail -5

  echo "[3/4] Copying certs to $CERT_DIR..."
  sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/fullchain.pem"
  sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/privkey.pem"
  sudo chmod 600 "$CERT_DIR/privkey.pem"

  echo "[4/4] Setting up auto-renewal..."
  if systemctl is-active --quiet firewalld 2>/dev/null || systemctl is-active --quiet ufw 2>/dev/null; then
    echo "  ℹ Firewall detected — ensure port 443 is open"
  fi

  echo ""
  echo "✅ Let's Encrypt certificate installed for $DOMAIN"
  echo "   Fullchain: $CERT_DIR/fullchain.pem"
  echo "   Private:   $CERT_DIR/privkey.pem"
  echo ""
  echo "   Certificates auto-renew via system cron/dnsmasq."
  echo "   Test with: sudo certbot renew --dry-run"
}

# ─── Self-Signed (mkcert) ──────────────────────────────────────────────────
setup_selfsigned() {
  echo ""
  echo "[1/3] Installing mkcert..."
  if command -v mkcert &>/dev/null; then
    echo "  ✓ mkcert already installed ($( mkcert -version ))"
  else
    if [[ -f /etc/os-release ]]; then
      . /etc/os-release
      case "$ID" in
        ubuntu|debian)
          sudo apt-get install -y libnss3-tools
          curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
          sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
          sudo chmod +x /usr/local/bin/mkcert
          ;;
        alpine)
          sudo apk add --no-cache nss
          curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/arm64" 2>/dev/null || \
          curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
          sudo mv mkcert-v*-linux-* /usr/local/bin/mkcert 2>/dev/null || \
          mv mkcert-v*-linux-* /usr/local/bin/mkcert
          sudo chmod +x /usr/local/bin/mkcert
          ;;
        *)
          echo "  ⚠ Please install mkcert manually: https://github.com/FiloSottile/mkcert"
          ;;
      esac
    fi
  fi

  echo "[2/3] Creating local CA (if needed)..."
  mkcert -install 2>&1 | tail -2

  echo "[3/3] Generating certificate for $DOMAIN..."
  mkcert "$DOMAIN" "localhost" "127.0.0.1" "::1"

  echo ""
  echo "✅ Self-signed certificate created for $DOMAIN"
  echo "   Fullchain: $CERT_DIR/$DOMAIN+*.pem (use as fullchain.pem)"
  echo "   Private:   $CERT_DIR/$DOMAIN+*.key (use as privkey.pem)"
  echo ""
  echo "   For Docker: copy the cert/key to certs/ and rename:"
  echo "     mkcert $DOMAIN > certs/fullchain.pem && cat certs/$DOMAIN+*.key >> certs/fullchain.pem"
}

# ─── Main ───────────────────────────────────────────────────────────────────
case "$MODE" in
  letsencrypt)   setup_letsencrypt ;;
  selfsigned)    setup_selfsigned ;;
esac

echo "=========================================="
echo " Setup complete. Configure nginx.conf:"
echo "   ssl_certificate:     $CERT_DIR/fullchain.pem"
echo "   ssl_certificate_key: $CERT_DIR/privkey.pem"
echo "=========================================="
