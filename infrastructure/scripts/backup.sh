#!/bin/bash
# SMART_TECH SAAS SYSTEM - Database Backup Script
# Usage: ./backup.sh [full|schema|data]

set -e

# Configuration
DB_USER="${DB_USER:-smarttech}"
DB_PASSWORD="${DB_PASSWORD}"
DB_NAME="${DB_NAME:-school_saas}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup type
BACKUP_TYPE="${1:-full}"

echo "Starting $BACKUP_TYPE backup at $(date)"

case $BACKUP_TYPE in
  full)
    BACKUP_FILE="$BACKUP_DIR/full_backup_$TIMESTAMP.sql.gz"
    PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME | gzip > "$BACKUP_FILE"
    echo "Full backup created: $BACKUP_FILE"
    ;;
  schema)
    BACKUP_FILE="$BACKUP_DIR/schema_backup_$TIMESTAMP.sql"
    PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only > "$BACKUP_FILE"
    echo "Schema backup created: $BACKUP_FILE"
    ;;
  data)
    BACKUP_FILE="$BACKUP_DIR/data_backup_$TIMESTAMP.sql"
    PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --data-only > "$BACKUP_FILE"
    echo "Data backup created: $BACKUP_FILE"
    ;;
  *)
    echo "Invalid backup type. Use: full, schema, or data"
    exit 1
    ;;
esac

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup verified: $FILE_SIZE"
else
  echo "ERROR: Backup file not created!"
  exit 1
fi

# Clean old backups
echo "Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.sql*" -mtime +$RETENTION_DAYS -delete

echo "Backup completed at $(date)"
