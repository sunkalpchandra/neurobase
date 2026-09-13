#!/bin/bash
# Serves the built application on a local port. launchd runs this to keep NeuroBase
# up across logins; `npm run serve` runs the same thing in the foreground.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Homebrew's node and postgres tools are not on launchd's PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export NODE_ENV=production

PORT="${NEUROBASE_PORT:-3100}"
LOG_DIR="$PROJECT_DIR/.serve-logs"
LOG="$LOG_DIR/serve.log"
mkdir -p "$LOG_DIR"

# `next start` serves a build, it does not make one. Failing loudly here beats
# launchd restarting a process that can never succeed.
if [ ! -f .next/BUILD_ID ]; then
  echo "No production build in .next. Run: npm run build" >&2
  exit 1
fi

# Rotate on start rather than on size: the process is long-lived, so this is the
# only moment no writer holds the file open. Five generations, then gone.
if [ -f "$LOG" ]; then
  for generation in 4 3 2 1; do
    [ -f "$LOG.$generation" ] && mv "$LOG.$generation" "$LOG.$((generation + 1))"
  done
  mv "$LOG" "$LOG.1"
fi
rm -f "$LOG.6"

exec >>"$LOG" 2>&1
echo "=== NeuroBase serve $(date -u +%Y-%m-%dT%H:%M:%SZ) on port $PORT ==="

# Postgres is a separate service. At login launchd may reach this before Postgres
# is accepting connections, and a server that starts without its database serves
# errors rather than records.
for _ in $(seq 1 30); do
  pg_isready -q -h localhost -p 5432 && break
  sleep 2
done
pg_isready -q -h localhost -p 5432 || echo "Postgres is not accepting connections; starting anyway."

# exec so launchd tracks the server itself, not a shell wrapping it: the PID it
# watches is the one it has to signal to stop.
exec node node_modules/next/dist/bin/next start --port "$PORT"
