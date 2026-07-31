#!/bin/sh
set -eu
cd /app
exec node scripts/start-with-db.mjs "$@"
