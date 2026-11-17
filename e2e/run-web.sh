#!/usr/bin/env bash
# Builds the website with a placeholder Google client ID and runs the website
# end-to-end test against it. No real Google account is used.
set -euo pipefail
VITE_GOOGLE_CLIENT_ID="e2e-test.apps.googleusercontent.com" npx vite build --mode web --logLevel warn
npx vite preview --mode web --port 4180 --strictPort >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf http://localhost:4180/ >/dev/null && break; sleep 0.25; done
node --experimental-strip-types --no-warnings e2e/web.e2e.mjs
