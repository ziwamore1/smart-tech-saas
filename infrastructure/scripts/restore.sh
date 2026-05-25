#!/bin/bash
# SMART_TECH SAAS SYSTEM - Database Restore Script
# Usage: ./restore.sh <backup_file>

set -e

# Configuration
DB_USER="${DB_USER:-smarttech}"
DB_PASSWORD="${DB_PASSWORD}"
DB_NAME="${DB_NAME:-school_saas}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  echo "Available backups:"
  ls -la ./backups/*.sql* 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_FILE="$1"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will restore the database from $BACKUP_FILE"
echo "Current database: $DB_NAME on $DB_HOST:$DB_PORT"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

# Create pre-restore backup
echo "Creating pre-restore backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PRE_RESTORE_BACKUP="./backups/pre_restore_$TIMESTAMP.sql"
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > "$PRE_RESTORE_BACKUP"
echo "Pre-restore backup created: $PRE_RESTORE_BACKUP"

# Restore database
echo "Restoring database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
else
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < "$BACKUP_FILE"
fi

echo "Database restored successfully!"
echo "Pre-restore backup saved at: $PRE_RESTORE_BACKUP"
