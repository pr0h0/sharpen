#!/usr/bin/env bash
# Play every lesson of a course in headless Chromium (tools/autoplay.js) and print one line per lesson.
# Usage: tools/play_course.sh <course-id> [out-dir]
set -euo pipefail
cd "$(dirname "$0")/.."
course="$1"
out="${2:-/tmp/sharpen-qa}"
mkdir -p "$out"; rm -rf "$out/prof"
steps=$(bun -e "
import { COURSES } from './src/courses';
const c = COURSES.find((x) => x.id === '$course');
if (!c) { console.error('no course $course'); process.exit(1); }
const st = [];
for (const l of c.lessons) { st.push(['js', \"location.hash='#/lesson/$course/\" + l.id + \"'; '\" + l.id + \"'\"], ['wait', 0.5], ['jsfile', 'tools/autoplay.js']); }
st.push(['shot', 'end']);
console.log(JSON.stringify(st));
")
timeout 900 python3 -I tools/web_qa.py "$out" "$steps" > /dev/null
paste -d' ' <(grep -v 'steps ' "$out/console.txt" | grep '^\[js\]' | sed 's/\[js\] //') <(grep 'steps ' "$out/console.txt" | sed 's/\[js\] //')
grep -v '^\[js\]' "$out/console.txt" || true
