#!/bin/bash
# Azure App Service startup script
# Installs Bun if not present and starts the API server

if ! command -v bun &> /dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

bun run server/index.ts
