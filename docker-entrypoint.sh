#!/bin/sh
set -eu

seed_if_missing() {
  target_path="$1"
  seed_path="$2"

  target_dir=$(dirname "$target_path")
  mkdir -p "$target_dir"

  if [ ! -f "$target_path" ] && [ -f "$seed_path" ]; then
    cp "$seed_path" "$target_path"
  fi
}

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
seed_if_missing "${SHADOW_EDGE_DATA_FILE:-/data/store.json}" "/app/seed-data/store.json"
mkdir -p "${SHADOW_EDGE_UPLOAD_DIR:-/data/uploads}"

exec /app/shadow-edge-server
