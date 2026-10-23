#!/bin/sh
set -u

# Maintenance commands are one-shot and must preserve their exit status.
if [ "$#" -gt 0 ]; then exec /app/shadow-edge-server "$@"; fi

# Keep retrying even when the database is unavailable longer than the Machine's
# finite on-failure budget. Exactly one child/writer runs at any time.
child=""
group=""
delay=1
clean_group() {
  if [ -n "$group" ]; then
    kill -TERM "-$group" 2>/dev/null || true
    kill -KILL "-$group" 2>/dev/null || true
    group=""
  fi
}
stop() {
  trap '' TERM INT
  if [ -n "$child" ]; then
    kill -TERM "$child" 2>/dev/null || true
    wait "$child" 2>/dev/null || true
  fi
  clean_group
  exit 0
}
trap stop TERM INT
while :; do
  started=$(date +%s)
  if command -v setsid >/dev/null 2>&1; then
    setsid /app/shadow-edge-server "$@" &
    child=$!
    group=$child
  else
    # Git's Windows shell has no setsid; the production image installs it.
    /app/shadow-edge-server "$@" &
    child=$!
  fi
  wait "$child"
  status=$?
  # Codex/image helper descendants must not survive their old server process.
  clean_group
  child=""
  elapsed=$(( $(date +%s) - started ))
  if [ "$elapsed" -ge 60 ]; then delay=1; fi
  echo "server supervisor: child exited status=$status; retry_in=${delay}s" >&2
  sleep "$delay" &
  child=$!
  wait "$child" || true
  child=""
  if [ "$delay" -lt 30 ]; then delay=$((delay * 2)); fi
  if [ "$delay" -gt 30 ]; then delay=30; fi
done
