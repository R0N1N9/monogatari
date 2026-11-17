#!/usr/bin/env bash
# Runs the desktop end-to-end test against target/release/monogatari on Linux.
#
# Needs: xvfb, webkit2gtk-driver (WebKitWebDriver), and `cargo install tauri-driver`.
# Build the app first with: npx tauri build --no-bundle
#
# The app's data goes to a throwaway folder (via XDG_DATA_HOME), so a real story
# on this computer is never read or touched.
set -euo pipefail

DATA="$(mktemp -d -t monogatari-e2e-XXXXXX)"
cleanup() { rm -rf "$DATA"; }
trap cleanup EXIT

export XDG_DATA_HOME="$DATA"
export WEBKIT_DISABLE_COMPOSITING_MODE=1

xvfb-run -a -s "-screen 0 1280x880x24" bash -c '
  tauri-driver > "$XDG_DATA_HOME/driver.log" 2>&1 &
  DRIVER=$!
  trap "kill $DRIVER 2>/dev/null; pkill -P $DRIVER 2>/dev/null; true" EXIT
  for _ in $(seq 1 40); do curl -sf http://127.0.0.1:4444/status >/dev/null && break; sleep 0.25; done
  node e2e/desktop.e2e.mjs
'
