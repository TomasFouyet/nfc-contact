#!/usr/bin/env bash
# Muestra las cabeceras HTTP reales que entrega un hosting para cada archivo
# de prueba. Uso:
#   tools/check-headers.sh https://tomasfouyet.github.io/nfc-contact
#   tools/check-headers.sh http://localhost:8080
set -euo pipefail
BASE="${1:?Uso: $0 URL_BASE (sin barra final)}"
PATHS=(
  /tomas.vcf
  /lab/vcards/contacto-v30.vcf
  /lab/vcards/contacto-v30.vcard
  /lab/vcards/contacto-v21.vcf
  /lab/vcards/contacto-v40.vcf
  /lab/http/inline-vcard.vcf
  /lab/http/attachment-vcard.vcf
  /lab/http/x-vcard.vcf
  /lab/http/directory.vcf
  /lab/http/octet-stream.vcf
  /lab/r/vcf
  /lab/r/intent
)
for p in "${PATHS[@]}"; do
  echo "== $BASE$p"
  curl -sS -o /dev/null -D - "$BASE$p" | grep -iE '^(HTTP/|content-type|content-disposition|location|cache-control)' || true
done
