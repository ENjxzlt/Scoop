#!/bin/sh
set -e

if [ "$(id -u)" = '0' ]; then
  mkdir -p "${DATA_DIR:-/app/data}"
  chown -R node:node "${DATA_DIR:-/app/data}"
  exec su-exec node "$@"
fi

exec "$@"
