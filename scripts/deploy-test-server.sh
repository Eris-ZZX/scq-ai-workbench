#!/usr/bin/env bash
set -euo pipefail

# This script runs on the Linux test server.
# It pulls the deployment branch and rebuilds the app in Docker Compose.
ROOT=/opt/qe-workbench-it
PROJECT=qe-it-workbench
REPO_URL=https://github.com/Eris-ZZX/scq-ai-workbench.git
BRANCH=dev
SOURCE="$ROOT/source"
CURRENT="$ROOT/current"
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASE="$ROOT/releases/$STAMP"
BACKUP="$ROOT/backup-$STAMP"
ARCHIVE="/tmp/qe-workbench-source-$STAMP.tar.gz"

cleanup() {
  rm -f "$ARCHIVE"
}
trap cleanup EXIT

mkdir -p "$ROOT/releases"

echo "=== sync repository ==="
if [ ! -d "$SOURCE/.git" ]; then
  if [ -e "$SOURCE" ]; then
    mv "$SOURCE" "$ROOT/source-backup-$STAMP"
  fi
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$SOURCE"
else
  git -C "$SOURCE" fetch origin "$BRANCH"
  # SOURCE is a deployment mirror. Discard hot patches or other local edits
  # so the release always matches the remote branch exactly.
  git -C "$SOURCE" reset --hard "origin/$BRANCH"
fi

COMMIT=$(git -C "$SOURCE" rev-parse --short HEAD)
echo "repository=$REPO_URL branch=$BRANCH commit=$COMMIT"

echo "=== prepare release ==="
rm -rf "$RELEASE"
mkdir -p "$RELEASE"
git -C "$SOURCE" archive --format=tar.gz --output="$ARCHIVE" HEAD
tar -xzf "$ARCHIVE" -C "$RELEASE"

if [ -f "$CURRENT/.env" ]; then
  cp -a "$CURRENT/.env" "$RELEASE/.env"
elif [ -f "$RELEASE/.env.example" ]; then
  cp "$RELEASE/.env.example" "$RELEASE/.env"
else
  echo 'DEPLOY_FAILED missing runtime .env'
  exit 1
fi
chmod 600 "$RELEASE/.env"

PORT=$(awk -F= '$1 == "APP_HOST_PORT" {print $2; exit}' "$RELEASE/.env" | tr -d '"' | tr -d "'" | tr -d ' ')
PORT=${PORT:-3000}

cd "$RELEASE"
echo "=== build new app image ==="
docker compose --project-name "$PROJECT" --env-file .env -f docker-compose.yml build app

echo "=== promote release ==="
if [ -e "$CURRENT" ] || [ -L "$CURRENT" ]; then
  mv "$CURRENT" "$BACKUP"
fi
mv "$RELEASE" "$CURRENT"
cd "$CURRENT"

echo "=== recreate app ==="
docker compose --project-name "$PROJECT" --env-file .env -f docker-compose.yml up -d --no-build --force-recreate app

ready=0
for i in $(seq 1 72); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/login" || true)
  if [ "$code" = "200" ]; then
    ready=1
    echo "ready after ${i} attempts on port ${PORT}"
    break
  fi
  if [ $((i % 6)) -eq 0 ]; then
    echo "still waiting attempt=${i} http=${code}"
    docker compose --project-name "$PROJECT" --env-file .env -f docker-compose.yml logs --tail 30 app || true
  fi
  sleep 5
done

echo '=== compose status ==='
docker compose --project-name "$PROJECT" --env-file .env -f docker-compose.yml ps
echo '=== app startup logs ==='
docker compose --project-name "$PROJECT" --env-file .env -f docker-compose.yml logs --tail 100 app || true

if [ "$ready" != "1" ]; then
  echo "DEPLOY_FAILED release=$STAMP backup=$BACKUP commit=$COMMIT"
  exit 1
fi

echo "DEPLOY_OK release=$STAMP backup=$BACKUP commit=$COMMIT port=$PORT"
