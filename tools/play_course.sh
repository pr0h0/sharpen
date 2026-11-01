#!/usr/bin/env bash
# Play every lesson of a course in headless Chromium (tools/autoplay.js) and print one line per lesson.
# Usage: tools/play_course.sh <course-id> [out-dir]      (QA_SLOT=1..9 for an isolated build and ports)
set -euo pipefail
cd "$(dirname "$0")/.."
course="$1"
out="${2:-/tmp/sharpen-qa}"
mkdir -p "$out"; rm -rf "$out/prof"
# QA_SLOT=N: build into a private dir and use private ports, so several runs can go at once
# without touching dist/ (the live site) or each other.
if [[ -n "${QA_SLOT:-}" ]]; then
  OUT="$out/dist" bash tools/build.sh > /dev/null
  SHARPEN_DB="$out/qa.db" python3 tools/serve.py $((4960 + QA_SLOT)) 127.0.0.1 "$out/dist" & srv=$!
  trap 'kill $srv 2>/dev/null' EXIT
  export QA_URL="http://127.0.0.1:$((4960 + QA_SLOT))/" QA_DEBUG_PORT=$((9340 + QA_SLOT))
  sleep 0.5
fi
steps=$(bun -e "
import { ALL_COURSES } from './src/courses';
const c = ALL_COURSES.find((x) => x.id === '$course');
if (!c) { console.error('no course $course'); process.exit(1); }
const st = [];
for (const l of c.lessons) { st.push(['js', \"location.hash='#/lesson/$course/\" + l.id + \"'; '\" + l.id + \"'\"], ['wait', 0.5], ['jsfile', 'tools/autoplay.js']); }
st.push(['shot', 'end']);
console.log(JSON.stringify(st));
")
timeout 900 python3 -I tools/web_qa.py "$out" "$steps" > /dev/null
paste -d' ' <(grep -v 'steps ' "$out/console.txt" | grep '^\[js\]' | sed 's/\[js\] //') <(grep 'steps ' "$out/console.txt" | sed 's/\[js\] //')
grep -v '^\[js\]' "$out/console.txt" || true
