#!/usr/bin/env bash
# Build the static site into dist/ (served on http://localhost:4956 by tools/serve.py).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
cp public/* dist/
bun build ./src/main.ts --outdir ./dist --entry-naming app.js --target browser --minify --sourcemap=linked
echo "Sharpen built: http://localhost:4956"
