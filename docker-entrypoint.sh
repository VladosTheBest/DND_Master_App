#!/bin/sh
set -eu

restore_backup_if_missing() {
  target_path="$1"
  backup_path="$2"

  target_dir=$(dirname "$target_path")
  mkdir -p "$target_dir"

  if [ ! -f "$target_path" ] && [ -f "$backup_path" ]; then
    cp "$backup_path" "$target_path"
  fi
}

restore_backup_if_missing "${SHADOW_EDGE_DATA_FILE:-/data/store.json}" "${SHADOW_EDGE_DATA_FILE:-/data/store.json}.bak"
mkdir -p "${SHADOW_EDGE_UPLOAD_DIR:-/data/uploads}"

exec /app/shadow-edge-server "$@"
