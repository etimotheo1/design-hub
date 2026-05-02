#!/bin/bash
# Double-click this file in Finder to start Design Hub.
# It will:
#   1. Install dependencies the first time (2-3 minutes)
#   2. Start the local web server
#   3. You then open http://localhost:3000 in your browser
#
# To stop the server: come back to this Terminal window and press Ctrl+C
# To start again: just double-click this file again.

set -e

# Move to the folder this script is in (so it works from anywhere on your Mac).
cd "$(dirname "$0")"

clear
echo ""
echo "  ┌───────────────────────────────────────────────┐"
echo "  │   Design Hub — local development server        │"
echo "  └───────────────────────────────────────────────┘"
echo ""
echo "  Folder:  $(pwd)"
echo "  Node:    $(node --version 2>/dev/null || echo 'NOT INSTALLED — install from nodejs.org first')"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌  Node.js is not installed."
  echo "    Download it from https://nodejs.org/en/download (LTS) and try again."
  echo ""
  echo "Press any key to close this window..."
  read -n 1
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦  First-time setup: installing dependencies..."
  echo "    (This takes 2–3 minutes. Lots of text will scroll — that's normal.)"
  echo ""
  npm install
  echo ""
  echo "✅  Dependencies installed."
  echo ""
fi

echo "🚀  Starting Design Hub..."
echo ""
echo "    Once you see  ▸  Ready in [number]ms"
echo "    open this in your browser:"
echo ""
echo "        http://localhost:3000"
echo ""
echo "    Sign in with username  elia  /  password  changeme"
echo ""
echo "    To stop the server later, come back here and press  Ctrl + C"
echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

npm run dev
