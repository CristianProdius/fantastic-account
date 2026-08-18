#!/usr/bin/env bash
# First-run for Mihail's (or any) machine. Safe to re-run.
# Does not touch Prodius (port 54329 / prodius_accounting).

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
accounting="$repo_root/accounting"
live_url="postgres://postgres:postgres@127.0.0.1:54339/fantastic_accounting"
mcp_js="$accounting/dist/src/index.js"

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

say "== Fantastic Account initiate =="
say "repo: $repo_root"

if [[ "$repo_root" == *ProdiusEnterprise* ]]; then
  die "refusing to run inside ProdiusEnterprise"
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

if ! need_cmd brew; then
  say "Homebrew missing. Install it, then re-run:"
  say '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  die "homebrew not found"
fi

if ! need_cmd git; then
  say "Installing git..."
  brew install git
fi

if ! need_cmd node; then
  say "Installing Node..."
  brew install node@22
  brew link --overwrite --force node@22 || true
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$node_major" -lt 20 ]]; then
  die "Node $node_major is too old. Need 20+ (22 preferred)."
fi

if ! need_cmd pnpm; then
  say "Enabling pnpm..."
  corepack enable
  corepack prepare pnpm@10 --activate
fi

if ! need_cmd docker; then
  say "Installing Docker Desktop..."
  brew install --cask docker
  open -a Docker || true
  die "Docker Desktop was installed. Open it, wait until it is running, then re-run: bash scripts/initiate.sh"
fi

if ! docker info >/dev/null 2>&1; then
  open -a Docker || true
  say "Waiting for Docker Desktop..."
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
fi

docker info >/dev/null 2>&1 || die "Docker is not running. Open Docker Desktop and re-run this script."

if docker ps --format '{{.Ports}}' | grep -q '54329'; then
  say "Note: something is listening via a 54329 mapping. We will not use it."
fi

cd "$accounting"
if [[ ! -f .env ]]; then
  cp .env.example .env
  say "wrote accounting/.env"
fi

say "pnpm install..."
pnpm install

say "starting Postgres on 54339..."
pnpm db:up

for _ in $(seq 1 30); do
  if docker exec fantastic-accounting-db-1 pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec fantastic-accounting-db-1 pg_isready -U postgres >/dev/null 2>&1 \
  || die "Postgres container did not become ready"

declaration_count="$(
  docker exec fantastic-accounting-db-1 \
    psql -U postgres -d fantastic_accounting -tAc 'select count(*) from declarations' \
    2>/dev/null || echo 0
)"
declaration_count="${declaration_count// /}"

if [[ "${declaration_count:-0}" == "0" ]]; then
  say "empty database — migrate, seed, import declarations..."
  pnpm db:setup
  pnpm import:declarations
else
  say "database already has $declaration_count declarations — skip db:setup"
  pnpm db:migrate
  pnpm db:seed
fi

say "tests..."
pnpm test

say "build MCP server..."
pnpm build
[[ -f "$mcp_js" ]] || die "build did not produce $mcp_js"

cat > "$repo_root/.mcp.json" <<EOF
{
  "mcpServers": {
    "fantastic-accounting": {
      "command": "node",
      "args": ["$mcp_js"],
      "env": {
        "DATABASE_URL": "$live_url"
      }
    }
  }
}
EOF
say "wrote $repo_root/.mcp.json"

say ""
say "== Claude Desktop — merge this server, do not replace other servers =="
say "File: ~/Library/Application Support/Claude/claude_desktop_config.json"
cat <<EOF
"fantastic-accounting": {
  "command": "node",
  "args": ["$mcp_js"],
  "env": {
    "DATABASE_URL": "$live_url"
  }
}
EOF

say ""
say "== Codex — append to ~/.codex/config.toml =="
cat <<EOF
[mcp_servers.fantastic-accounting]
command = "node"
args = ["$mcp_js"]

[mcp_servers.fantastic-accounting.env]
DATABASE_URL = "$live_url"
EOF

say ""
say "Done. Restart Claude / Grok / Codex, then: treci pe Fantastic"
