#!/bin/bash
# Setup VPS untuk webchat backend (Ubuntu/Debian).
# Jalankan sebagai root atau dengan sudo:
#   chmod +x setup-vps.sh && sudo ./setup-vps.sh
#
# Script ini idempotent — aman dijalankan ulang tanpa efek samping.

set -euo pipefail

echo "=== [1/7] Update sistem ==="
apt-get update -y
apt-get upgrade -y

echo "=== [2/7] Install Node.js 22 LTS ==="
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js $(node -v) terpasang"

echo "=== [3/7] Install PM2 ==="
if ! command -v pm2 &>/dev/null; then
    npm install -g pm2
fi
echo "PM2 $(pm2 -v) terpasang"

echo "=== [4/7] Install Nginx ==="
if ! command -v nginx &>/dev/null; then
    apt-get install -y nginx
fi
systemctl enable nginx
systemctl start nginx
echo "Nginx terpasang dan berjalan"

echo "=== [5/7] Install Certbot (SSL gratis) ==="
if ! command -v certbot &>/dev/null; then
    apt-get install -y certbot python3-certbot-nginx
fi
echo "Certbot terpasang"

echo "=== [6/7] Install SQLite3 (untuk backup) ==="
if ! command -v sqlite3 &>/dev/null; then
    apt-get install -y sqlite3
fi
echo "SQLite3 terpasang"

echo "=== [7/7] Buat folder log ==="
mkdir -p /var/log/webchat

echo ""
echo "====================================="
echo "  Setup VPS selesai!"
echo "====================================="
echo ""
echo "Langkah selanjutnya (jalankan manual):"
echo ""
echo "  1. Clone repo:"
echo "     git clone https://github.com/fagangans/FAiAgentWebsite.git"
echo "     cd FAiAgentWebsite/webchat/backend"
echo ""
echo "  2. Install dependencies:"
echo "     npm install --production"
echo ""
echo "  3. Buat .env:"
echo "     cp .env.example .env"
echo "     nano .env"
echo "     # Isi GEMINI_API_KEY, ADMIN_TOKEN, set USE_MOCK_AI=false"
echo ""
echo "  4. Jalankan dengan PM2:"
echo "     pm2 start ecosystem.config.cjs"
echo "     pm2 save"
echo "     pm2 startup  # supaya otomatis jalan saat VPS reboot"
echo ""
echo "  5. Setup Nginx:"
echo "     cp deploy/nginx-webchat.conf /etc/nginx/sites-available/webchat"
echo "     ln -sf /etc/nginx/sites-available/webchat /etc/nginx/sites-enabled/"
echo "     nano /etc/nginx/sites-available/webchat  # ganti DOMAIN_ANDA"
echo "     nginx -t && systemctl reload nginx"
echo ""
echo "  6. SSL (setelah domain sudah pointing ke IP VPS):"
echo "     certbot --nginx -d api.DOMAIN_ANDA.com"
echo ""
echo "  7. Backup otomatis (opsional tapi sangat disarankan):"
echo "     chmod +x deploy/backup-db.sh"
echo "     crontab -e"
echo "     # Tambahkan: 0 3 * * * /path/to/deploy/backup-db.sh"
echo ""
