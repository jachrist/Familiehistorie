#!/usr/bin/env bash
# Prøvegjenoppretting.
#
# Dette er skriptet folk hopper over, og det er det eneste som beviser at
# sikkerhetskopien er verdt noe. Kjør det før du legger inn ekte data, og
# deretter et par ganger i året.
#
#   ./gjenopprett-proeve.sh

set -euo pipefail

# shellcheck disable=SC1091
source /etc/familiehistorie/restic.env

MAAL=$(mktemp -d)
trap 'rm -rf "$MAAL"' EXIT

echo "▸ Siste sikkerhetskopier"
restic snapshots --latest 3

echo
echo "▸ Gjenoppretter siste til $MAAL"
restic restore latest --target "$MAAL"

echo
echo "▸ Det som kom tilbake"
du -sh "$MAAL"/srv/* 2>/dev/null || true
echo
find "$MAAL" -type f | wc -l | xargs echo "filer totalt:"

echo
echo "Se over listen over. Er det du forventer der, er kopien god."
echo "Katalogen slettes når skriptet avsluttes."
