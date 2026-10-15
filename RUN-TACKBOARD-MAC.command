#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then echo "Node.js 22+ required"; exit 1; fi
if [ ! -d node_modules/electron ]; then npm install; fi
npm start
