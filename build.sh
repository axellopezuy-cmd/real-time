#!/usr/bin/env bash
set -euo pipefail

echo "=== Real Time — Build ==="

# 1. Build panel-browser (frontend)
echo "[1/3] Building panel-browser..."
(cd panel-browser && npm ci && npm run build)

# 2. Build Rust workspace (release)
echo "[2/3] Building Rust workspace (release)..."
cargo build --release

# 3. Verify binary exists
BINARY="target/release/realtime"
if [[ -f "$BINARY" ]]; then
  echo "[3/3] ✓ Binary: $BINARY"
  echo ""
  echo "Build complete. Run with:"
  echo "  $BINARY [directory]"
else
  echo "[3/3] ✗ Binary not found at $BINARY"
  exit 1
fi
