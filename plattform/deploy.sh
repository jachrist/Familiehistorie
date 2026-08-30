#!/usr/bin/env bash
# Utrulling av én app.
#
#   ./deploy.sh proev-app
#
# Kjøres på tjeneren, enten manuelt over SSH eller fra GitHub Actions.
# Idempotent: kjør den så mange ganger du vil.

set -euo pipefail

APP="${1:?Bruk: ./deploy.sh <appnavn>}"
REPO="${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DATAROT="${DATAROT:-/srv}"

cd "$REPO"

echo "▸ Henter siste kode"
git fetch --quiet origin
GREN=$(git rev-parse --abbrev-ref HEAD)
git reset --hard --quiet "origin/$GREN"

VERSJON=$(git rev-parse --short HEAD)
BYGGET=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "  $GREN @ $VERSJON"

echo "▸ Sørger for at datakatalogen finnes"
# Containeren kjører som uid 1000 (node-brukeren i grunnimaget).
sudo mkdir -p "$DATAROT/$APP/data"
sudo chown -R 1000:1000 "$DATAROT/$APP/data"

echo "▸ Bygger og starter"
cd "$REPO/plattform"
VERSJON="$VERSJON" BYGGET="$BYGGET" docker compose up -d --build "$APP"

echo "▸ Venter på at appen svarer"
PORT=$(docker compose port "$APP" 8080 | cut -d: -f2)
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/helse" >/dev/null 2>&1; then
    SVAR=$(curl -fsS "http://127.0.0.1:$PORT/versjon")
    echo "  ok: $SVAR"
    echo
    echo "Utrullet $VERSJON."
    # Gamle images hoper seg opp og spiser disk. På en Pi merkes det fort.
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 1
done

echo "✖ Appen svarte ikke innen 30 sekunder. Siste logglinjer:" >&2
docker compose logs --tail 40 "$APP" >&2
exit 1
