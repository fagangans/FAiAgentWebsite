#!/bin/bash
# Backup database SQLite webchat. Jadwalkan via cron:
#   crontab -e
#   0 3 * * * /home/deploy/FAiAgentWebsite/webchat/deploy/backup-db.sh
#
# Backup disimpan 30 hari terakhir, lebih lama dihapus otomatis.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="${SCRIPT_DIR}/../backend/data/webchat.db"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
KEEP_DAYS=30

if [ ! -f "$DB_PATH" ]; then
    echo "[backup] Database tidak ditemukan: $DB_PATH"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/webchat_${TIMESTAMP}.db"

sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

gzip "$BACKUP_FILE"

find "$BACKUP_DIR" -name "webchat_*.db.gz" -mtime +${KEEP_DAYS} -delete

echo "[backup] Selesai: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))"
