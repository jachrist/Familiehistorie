#!/usr/bin/env bash
# Sikkerhetskopi med restic til Backblaze B2.
#
# Krever /etc/familiehistorie/restic.env med:
#   RESTIC_REPOSITORY=b2:bøttenavn:sti
#   RESTIC_PASSWORD=<lang tilfeldig streng — mist denne, og kopiene er tapt>
#   B2_ACCOUNT_ID=...
#   B2_ACCOUNT_KEY=...
#
# Filen skal eies av root med rettighet 600.

set -euo pipefail

# shellcheck disable=SC1091
source /etc/familiehistorie/restic.env

KILDE="${KILDE:-/srv}"

echo "▸ Sikkerhetskopierer $KILDE"
restic backup "$KILDE" \
  --tag automatisk \
  --exclude-caches \
  --exclude "*.tmp" \
  --exclude "**/node_modules"

echo "▸ Rydder gamle versjoner"
# Beholder nok til å oppdage en feil som skjedde for en stund siden.
restic forget \
  --keep-daily 7 \
  --keep-weekly 5 \
  --keep-monthly 12 \
  --prune

echo "▸ Kontrollerer et utvalg av dataene"
# Uten dette vet du bare at kopien finnes, ikke at den er lesbar.
restic check --read-data-subset=5%

echo "Ferdig $(date -Is)"
