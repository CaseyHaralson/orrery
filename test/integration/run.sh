#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Detect available agents ──────────────────────────────────────────

AVAILABLE_AGENTS=()
for agent in codex gemini claude; do
  if [ -d "$HOME/.$agent" ]; then
    AVAILABLE_AGENTS+=("$agent")
  fi
done

if [ ${#AVAILABLE_AGENTS[@]} -eq 0 ]; then
  echo "Error: No agent CLI detected."
  echo "Install at least one of: claude, codex, gemini"
  echo "Agent config directories checked: ~/.claude, ~/.codex, ~/.gemini"
  exit 1
fi

AGENT_PRIORITY=$(IFS=,; echo "${AVAILABLE_AGENTS[*]}")
echo "Detected agents: $AGENT_PRIORITY"

# ── Parse arguments ──────────────────────────────────────────────────

YES=false
SCENARIO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)
      YES=true
      shift
      ;;
    --scenario|-s)
      SCENARIO="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: run.sh [--yes] [--scenario <number>]"
      echo ""
      echo "Options:"
      echo "  --yes, -y              Skip confirmation prompt"
      echo "  --scenario, -s <num>   Run a single scenario (e.g., 01, 03)"
      echo "  --help, -h             Show this help"
      echo ""
      echo "Environment:"
      echo "  KEEP_SANDBOX=1         Preserve sandbox directories on failure"
      echo "  ORRERY_AGENT_TIMEOUT   Override agent timeout (default: 120000ms)"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# ── Confirmation ─────────────────────────────────────────────────────

if [ "$YES" != "true" ]; then
  echo ""
  echo "⚠  Integration tests invoke real AI agents and incur API charges."
  echo "   Estimated: 15-30 minutes, \$1-5 for a full run."
  echo ""
  read -rp "Continue? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ── Run tests ────────────────────────────────────────────────────────

export ORRERY_AGENT_PRIORITY="$AGENT_PRIORITY"
export ORRERY_AGENT_TIMEOUT="${ORRERY_AGENT_TIMEOUT:-120000}"

TEST_PATH="$SCRIPT_DIR/scenarios/"

if [ -n "$SCENARIO" ]; then
  # Pad scenario number to 2 digits
  PADDED=$(printf "%02d" "$SCENARIO")
  MATCH=$(find "$TEST_PATH" -name "${PADDED}-*.test.js" | head -1)
  if [ -z "$MATCH" ]; then
    echo "Error: No scenario matching '${PADDED}' found in $TEST_PATH"
    exit 1
  fi
  TEST_PATH="$MATCH"
  echo "Running scenario: $(basename "$MATCH")"
else
  echo "Running all integration scenarios..."
fi

echo ""

cd "$REPO_ROOT"
node --test --test-timeout=600000 "$TEST_PATH"
