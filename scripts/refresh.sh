#!/bin/bash
# Weekly refresh for a local NeuroBase: pull new records, reindex, log the result.
# Install it with `npm run schedule:install` (launchd) or run it from cron.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

LOG_DIR="$PROJECT_DIR/.refresh-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y-%m-%d).log"

# Homebrew's node is not on launchd's PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

{
  echo "=== NeuroBase refresh $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  npm run db:migrate
  npm run db:reference
  npm run corpus -- --scale "${REFRESH_SCALE:-0.5}"
  npm run corpus:report
  echo "=== finished $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
} >> "$LOG" 2>&1

# Keep a quarter of logs, no more.
find "$LOG_DIR" -name "*.log" -mtime +90 -delete 2>/dev/null || true
