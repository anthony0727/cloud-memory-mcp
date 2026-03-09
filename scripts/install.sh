#!/bin/bash
set -e

echo "=== cloud-memory-mcp installer ==="
echo ""

# detect config path
if [ -f "$HOME/.claude.json" ]; then
  CONFIG="$HOME/.claude.json"
elif [ -f "$HOME/Library/Application Support/Claude/claude_desktop_config.json" ]; then
  CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
else
  CONFIG="$HOME/.claude.json"
fi

echo "Select storage backend:"
echo "  1) local  (default, ~/.cloud-memory/)"
echo "  2) gdrive (Google Drive)"
echo "  3) github (GitHub private repo)"
read -rp "Choice [1]: " choice

case "$choice" in
  2) BACKEND="gdrive" ;;
  3) BACKEND="github" ;;
  *) BACKEND="local" ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "Adding cloud-memory-mcp to MCP config..."

# create minimal mcp.json entry
cat <<EOF

Add this to your MCP config ($CONFIG):

{
  "mcpServers": {
    "cloud-memory": {
      "command": "node",
      "args": ["${SCRIPT_DIR}/dist/server.js"],
      "env": {
        "CLOUD_MEMORY_BACKEND": "${BACKEND}"
      }
    }
  }
}

EOF

if [ "$BACKEND" = "gdrive" ]; then
  echo "For Google Drive, place your OAuth credentials at:"
  echo "  ~/.cloud-memory-credentials.json"
  echo ""
  echo "Get credentials: https://console.cloud.google.com/apis/credentials"
  echo "Enable: Google Drive API"
fi

if [ "$BACKEND" = "github" ]; then
  echo "For GitHub, set GITHUB_TOKEN in your env:"
  echo "  export GITHUB_TOKEN=ghp_..."
fi

echo ""
echo "Done! Run 'npm run build' in ${SCRIPT_DIR} then restart your AI client."
