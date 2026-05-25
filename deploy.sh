#!/usr/bin/env bash
set -euo pipefail

# Production deployment script for AD-Deen Engineering ERP
# Tested on Ubuntu 22.04 / Debian 12
# Usage: bash deploy.sh

APP_DIR="/opt/crm"
LOG_DIR="/var/log/crm"
DATA_DIR="/var/lib/crm"
DOMAIN="${DOMAIN:-yourdomain.com}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

echo "=== AD-Deen Engineering ERP Deployment ==="

# --- Prerequisites ---
if ! command -v node &>/dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v nginx &>/dev/null; then
  echo "Installing nginx..."
  apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
fi

# --- Create directories ---
mkdir -p "$APP_DIR" "$LOG_DIR" "$DATA_DIR"

# --- Copy application files ---
rsync -a --delete --exclude='node_modules' --exclude='.git' \
  "$(dirname "$0")/" "$APP_DIR/"

cd "$APP_DIR/backend"
npm install --omit=dev

# --- Install PM2 globally ---
npm install -g pm2

# --- Environment file ---
cat > "$APP_DIR/.env" <<EOF
PORT=3000
DB_PATH=$DATA_DIR/crm.db
JWT_SECRET=$JWT_SECRET
NODE_ENV=production
EOF

# --- PM2 ecosystem (overwrite) ---
cat > "$APP_DIR/ecosystem.config.js" <<PM2EOF
module.exports = {
  apps: [{
    name: 'crm',
    script: 'backend/server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_PATH: '$DATA_DIR/crm.db',
      JWT_SECRET: '$JWT_SECRET'
    },
    error_file: '$LOG_DIR/err.log',
    out_file: '$LOG_DIR/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_restarts: 10,
    restart_delay: 5000
  }]
};
PM2EOF

# --- Start application ---
pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save
pm2 startup systemd -u "$(whoami)" --hp "/home/$(whoami)"

# --- nginx configuration ---
cat > /etc/nginx/sites-available/crm <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# --- HTTPS via Let's Encrypt ---
echo "Optionally run: certbot --nginx -d $DOMAIN"

# --- Backup cron ---
cat > /etc/cron.daily/crm-backup <<'CRON'
#!/bin/sh
BACKUP_DIR="/var/backups/crm"
mkdir -p "$BACKUP_DIR"
DATE=$(date +\%Y-\%m-\%d)
cp /var/lib/crm/crm.db "$BACKUP_DIR/crm-$DATE.db"
find "$BACKUP_DIR" -name "crm-*.db" -mtime +30 -delete
CRON
chmod +x /etc/cron.daily/crm-backup

echo ""
echo "=== Deployment complete ==="
echo "App running at http://$DOMAIN"
echo "JWT_SECRET=$JWT_SECRET"
echo ""
echo "Next steps:"
echo "  1. Set your domain: export DOMAIN=yourdomain.com && bash deploy.sh"
echo "  2. Run certbot: certbot --nginx -d yourdomain.com"
echo "  3. Monitor: pm2 logs crm"
echo "  4. Backups: /var/backups/crm/"
