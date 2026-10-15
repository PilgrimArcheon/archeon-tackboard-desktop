#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
npm ci
npm test
printf '\nTackBoard Desktop source checks passed. Native installer tests are separate.\n'
