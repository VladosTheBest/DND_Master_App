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

seed_if_missing "${SHADOW_EDGE_DATA_FILE:-/data/store.json}" "/app/seed-data/store.json"
seed_if_missing "${SHADOW_EDGE_BESTIARY_CACHE_FILE:-/data/dndsu-bestiary.json}" "/app/seed-data/dndsu-bestiary.json"

exec /app/shadow-edge-server
