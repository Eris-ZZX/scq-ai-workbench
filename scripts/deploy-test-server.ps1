#!/usr/bin/env pwsh
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# The server pulls this repository itself; no source archive is uploaded from Windows.
$RemoteUser = 'root'
$RemoteHost = '43.110.141.102'
$RemoteRoot = '/opt/qe-workbench-it'
$ComposeProject = 'qe-it-workbench'
$RemoteRepository = 'https://github.com/Eris-ZZX/scq-ai-workbench.git'
$RemoteBranch = 'dev'
$SshKey = Join-Path $HOME '.ssh\trade_deploy_ed25519'

$RemoteTarget = '{0}@{1}' -f $RemoteUser, $RemoteHost
$SshOptions = @(
  '-i', $SshKey,
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=15',
  '-o', 'ServerAliveInterval=30'
)

function Test-RequiredCommand {
  param([Parameter(Mandatory)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

$RemoteDeployContent = @'
#!/bin/bash
set -eu

ROOT="$1"
PROJECT="$2"
REPO_URL="$3"
BRANCH="$4"
SOURCE="$ROOT/source"
CURRENT="$ROOT/current"
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASE="$ROOT/releases/$STAMP"
BACKUP="$ROOT/backup-$STAMP"
ARCHIVE="/tmp/qe-workbench-source-$STAMP.tar.gz"

trap 'rm -f "$ARCHIVE"' EXIT

mkdir -p "$ROOT/releases"

echo "=== sync repository ==="
if [ ! -d "$SOURCE/.git" ]; then
  if [ -e "$SOURCE" ]; then
    mv "$SOURCE" "$ROOT/source-backup-$STAMP"
  fi
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$SOURCE"
else
  git -C "$SOURCE" fetch origin "$BRANCH"
  git -C "$SOURCE" checkout "$BRANCH"
  git -C "$SOURCE" pull --ff-only origin "$BRANCH"
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
'@

Test-RequiredCommand 'ssh'

if (-not (Test-Path -LiteralPath $SshKey -PathType Leaf)) {
  throw "SSH key not found: $SshKey"
}

Write-Host "Deploying branch '$RemoteBranch' from the server-side repository..."
$RemoteCommand = "bash -s -- '$RemoteRoot' '$ComposeProject' '$RemoteRepository' '$RemoteBranch'"
$RemoteDeployContent | & ssh @SshOptions $RemoteTarget $RemoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "Remote deployment failed with exit code $LASTEXITCODE."
}

Write-Host "Deployment completed: http://${RemoteHost}:3000"
