#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then echo "Node.js 22+ required"; exit 1; fi
npm install
npm test
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac
echo "Builds are available in dist/"
