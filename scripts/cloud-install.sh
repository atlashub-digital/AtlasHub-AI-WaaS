#!/usr/bin/env bash
set -euo pipefail
export npm_config_cache=/workspace/.npm-cache
cd /workspace/atlas-agent-packs
npm run check
cd /workspace/App.AtlasHub.Si
npm ci --no-audit --no-fund
npm test
npm run lint
npm run typecheck
npm run build
cd /workspace/AtlasHub-AI-WaaS
npm ci --no-audit --no-fund
scripts/staging.sh
npm run check
