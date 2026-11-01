#!/usr/bin/env bash
# Build the static site into dist/ (served on http://localhost:4956 by tools/serve.py).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${OUT:-dist}"
rm -rf "$OUT" && mkdir -p "$OUT"
cp public/* "$OUT"/
bun build ./src/main.ts --outdir "$OUT" --entry-naming app.js --target browser --minify --sourcemap=linked
echo "Sharpen built: http://localhost:4956"
