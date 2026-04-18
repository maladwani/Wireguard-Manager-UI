#!/bin/bash
set -e

echo "=== WireGuard Manager ==="

export DATABASE_URL="${DATABASE_URL:-file:/data/app.db}"
export WG_CONFIG_PATH="${WG_CONFIG_PATH:-/etc/wireguard/wg0.conf}"

WG_DIR=$(dirname "$WG_CONFIG_PATH")
mkdir -p "$WG_DIR"

if [ ! -f "$WG_CONFIG_PATH" ]; then
  echo "No WireGuard config found. Generating server config..."
  PRIVKEY=$(wg genkey)
  cat > "$WG_CONFIG_PATH" <<EOF
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = $PRIVKEY
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth+ -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth+ -j MASQUERADE
EOF
  chmod 600 "$WG_CONFIG_PATH"
  echo "Server config created."
fi

if ! ip link show wg0 >/dev/null 2>&1; then
  echo "Bringing up WireGuard interface..."
  wg-quick up "$WG_CONFIG_PATH" || echo "Warning: Failed to bring up wg0 (will retry on first request)"
else
  echo "WireGuard interface wg0 is already up."
fi

if [ ! -f /data/app.db ]; then
  echo "Initializing database..."
  npx prisma migrate deploy --schema ./prisma/schema.prisma
  echo "Seeding default admin user..."
  node prisma/seed.mjs
else
  echo "Running pending migrations..."
  npx prisma migrate deploy --schema ./prisma/schema.prisma || true
fi

echo "Starting Next.js server..."
exec node server.js
