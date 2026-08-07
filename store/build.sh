#!/bin/bash
# Package Maxisave for the Chrome Web Store.
# Produces store/maxisave-<version>.zip with manifest.json at the zip root.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="$ROOT/store/maxisave-$VERSION.zip"

# Only the files the extension actually needs. The store/ folder — listing copy,
# privacy policy, promo art, this script — must not ship inside the package.
FILES=(manifest.json maxisave.js maxisave.css icons)

for f in "${FILES[@]}"; do
  [ -e "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

rm -f "$OUT"
zip -r -X "$OUT" "${FILES[@]}" \
  -x '*.DS_Store' -x '__MACOSX/*' >/dev/null

echo "built  $(basename "$OUT")  ($(du -h "$OUT" | cut -f1))"
echo
unzip -l "$OUT" | sed 's/^/  /'
