#!/usr/bin/env bash
# Smoke-test the accounts + sync API: tools/api_smoke.sh [base-url]  (default http://127.0.0.1:8799)
# Registers a throwaway user, exercises login/progress/CAS/logout. Delete the user afterwards on prod.
set -euo pipefail
B="${1:-http://127.0.0.1:8799}"; U="smoke_$RANDOM$RANDOM"; J=$(mktemp); trap 'rm -f "$J" "$J.big"' EXIT
H=(-H 'Content-Type: application/json' -H "Origin: $B" -b "$J" -c "$J")
req() { curl -s -o /dev/stderr -w '%{http_code}' -X "$1" "${H[@]}" "$B/api/$2" ${3:+-d "$3"} 2>/dev/null; }
expect() { local got; got=$(req "$2" "$3" "${4:-}"); [ "$got" = "$1" ] && echo "ok   $2 $3 -> $got" || { echo "FAIL $2 $3 -> $got (want $1)"; exit 1; }; }

expect 401 GET me
expect 200 POST register "{\"username\":\"$U\",\"password\":\"smoke-pass-1\"}"
expect 409 POST register "{\"username\":\"$U\",\"password\":\"smoke-pass-1\"}"
expect 200 GET me
expect 200 GET progress
expect 200 PUT progress '{"state":{"a":1},"base":0,"rev":"rev-0001"}'
expect 409 PUT progress '{"state":{"a":2},"base":0}'
expect 200 PUT progress '{"state":{"a":2},"base":1}'
{ printf '{"state":{"a":"'; head -c 300000 /dev/zero | tr '\0' x; printf '"},"base":2}'; } > "$J.big"   # > 256 KB cap
expect 413 PUT progress "@$J.big"
[ "$(curl -s "${H[@]}" "$B/api/progress?rev=rev-0001" | tr -d " ")" = '{"state":{"a":2},"version":2,"revVersion":1}' ] && echo "ok   progress+rev body" || { echo "FAIL progress body"; exit 1; }
curl -s -o /dev/null -X POST -H 'Content-Type: application/json' -H 'Origin: https://evil.example' "$B/api/logout" -d '{}' -w '%{http_code}' | grep -q 403 && echo "ok   cross-site refused" || { echo "FAIL cross-site"; exit 1; }
expect 200 POST logout '{}'
expect 401 GET me
expect 401 POST login "{\"username\":\"$U\",\"password\":\"wrong-pass\"}"
expect 200 POST login "{\"username\":\"$U\",\"password\":\"smoke-pass-1\"}"
echo "all ok (user $U)"
