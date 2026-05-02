#!/bin/bash
# One-click recovery: wipe a partial install and start clean.
# Use this if "Start Design Hub.command" gave compilation errors.

set -e
cd "$(dirname "$0")"

clear
echo ""
echo "  ┌───────────────────────────────────────────────┐"
echo "  │   Design Hub — reset and reinstall            │"
echo "  └───────────────────────────────────────────────┘"
echo ""
echo "  This will:"
echo "    1. Remove node_modules and package-lock.json"
echo "    2. Reinstall dependencies fresh"
echo "    3. Start the local server"
echo ""
echo "  Folder:  $(pwd)"
echo "  Node:    $(node --version 2>/dev/null || echo 'NOT INSTALLED')"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌  Node.js is not installed. Install it from https://nodejs.org/en/download"
  echo ""
  echo "Press any key to close this window..."
  read -n 1
  exit 1
fi

echo "🧹  Cleaning previous install..."
rm -rf node_modules package-lock.json
echo "    Done."
echo ""

echo "📦  Installing dependencies (1–2 minutes)..."
echo ""
npm install
echo ""
echo "✅  Install complete."
echo ""

echo "🚀  Starting Design Hub..."
echo ""
echo "    Once you see  ▸  Ready in [number]ms"
echo "    open this in your browser:"
echo ""
echo "        http://localhost:3000"
echo ""
echo "    Sign in with username  elia  /  password  changeme"
echo ""
echo "    To stop the server, press  Ctrl + C  in this window."
echo ""
echo "─────────────────────────────────────────────────────────"
echo ""

npm run dev
