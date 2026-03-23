#!/usr/bin/env bash
set -euo pipefail

REPO="axellopezuy-cmd/real-time"
VERSION="${1:-latest}"

echo ""
echo "  ⚡ Real Time — Installer"
echo ""

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)   PLATFORM="linux" ;;
  Darwin)  PLATFORM="macos" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *) echo "❌ OS no soportado: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_SUFFIX="x64" ;;
  arm64|aarch64) ARCH_SUFFIX="arm64" ;;
  *) echo "❌ Arquitectura no soportada: $ARCH"; exit 1 ;;
esac

ARTIFACT="realtime-${PLATFORM}-${ARCH_SUFFIX}"
if [[ "$PLATFORM" == "windows" ]]; then
  ARTIFACT="${ARTIFACT}.exe"
fi

# Determine download URL
if [[ "$VERSION" == "latest" ]]; then
  URL="https://github.com/${REPO}/releases/latest/download/${ARTIFACT}"
else
  URL="https://github.com/${REPO}/releases/download/${VERSION}/${ARTIFACT}"
fi

INSTALL_DIR="${HOME}/.local/bin"
mkdir -p "$INSTALL_DIR"

DEST="${INSTALL_DIR}/realtime"
if [[ "$PLATFORM" == "windows" ]]; then
  DEST="${INSTALL_DIR}/realtime.exe"
fi

echo "  Downloading ${ARTIFACT}..."
echo "  From: ${URL}"
echo ""

if command -v curl &>/dev/null; then
  HTTP_CODE=$(curl -fsSL -w "%{http_code}" "$URL" -o "$DEST" 2>/dev/null) || {
    echo "❌ Download failed. Check that the release exists at:"
    echo "   https://github.com/${REPO}/releases"
    rm -f "$DEST"
    exit 1
  }
elif command -v wget &>/dev/null; then
  wget -q "$URL" -O "$DEST" || {
    echo "❌ Download failed."
    rm -f "$DEST"
    exit 1
  }
else
  echo "❌ curl or wget required"; exit 1
fi

chmod +x "$DEST"

# Verify it runs
if "$DEST" --version &>/dev/null; then
  INSTALLED_VERSION=$("$DEST" --version 2>/dev/null | head -1)
  echo "  ✅ Installed: $DEST"
  echo "  Version: $INSTALLED_VERSION"
else
  echo "  ✅ Installed: $DEST"
fi

# Check PATH
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
  echo ""
  echo "  ⚠️  Add this to your shell profile (~/.bashrc, ~/.zshrc):"
  echo ""
  echo "     export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

echo ""
echo "  Usage: realtime ./my-project"
echo ""
