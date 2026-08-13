#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required: https://docs.docker.com/engine/install/" >&2
  exit 1
fi

if [ ! -S /var/run/docker.sock ]; then
  echo "Docker socket /var/run/docker.sock was not found." >&2
  exit 1
fi

DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)

if [ ! -f .env ]; then
  if command -v openssl >/dev/null 2>&1; then
    TOKEN=$(openssl rand -hex 24)
  else
    TOKEN=$(date +%s | sha256sum | cut -c1-48)
  fi
  printf 'API_TOKEN=%s\nDOCKVIEW_PORT=3000\nDOCKER_GID=%s\n' "$TOKEN" "$DOCKER_GID" > .env
  chmod 600 .env
elif grep -q '^DOCKER_GID=' .env; then
  sed -i "s/^DOCKER_GID=.*/DOCKER_GID=$DOCKER_GID/" .env
else
  printf 'DOCKER_GID=%s\n' "$DOCKER_GID" >> .env
fi

docker compose up -d --build
echo "Dockview is ready on http://SERVER_IP:3000"
echo "API key: $(sed -n 's/^API_TOKEN=//p' .env)"
