#!/bin/bash
set -euo pipefail

echo "=== check tsx in image ==="
docker exec qe-app sh -lc 'ls -la /app/node_modules/tsx 2>&1 | head -20; ls /app/node_modules/.bin 2>&1 | head -40; ls /app/node_modules/tsx/dist 2>&1 | head -20'

echo "=== seed ==="
docker exec -u root -e HOME=/tmp -e npm_config_cache=/tmp/npm-cache qe-app \
  sh -lc 'cd /app && if [ -f node_modules/tsx/dist/cli.mjs ]; then node node_modules/tsx/dist/cli.mjs ./prisma/seed.ts; elif [ -x node_modules/.bin/tsx ]; then ./node_modules/.bin/tsx ./prisma/seed.ts; else echo NO_TSX; ls node_modules | grep -i tsx || true; exit 2; fi'

echo "=== local login page ==="
curl -sI http://127.0.0.1:3000/login | sed -n '1,12p'

echo "=== public login page ==="
curl -sI --connect-timeout 10 http://43.110.141.102:3000/login | sed -n '1,12p'

echo "=== login api ==="
curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"zx123456"}'
echo

echo "=== status ==="
docker ps --filter name=qe-
free -h
