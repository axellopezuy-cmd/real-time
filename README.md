# ⚡ Real Time

Live HTML/CSS preview that updates as you type. No refresh. No build. No config.

```bash
realtime ./my-project
```

That's it. Your browser opens and shows your page. Every keystroke updates the preview instantly.

<!-- TODO: GIF demo -->

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/axellopezuy-cmd/real-time/main/install.sh | sh
```

Or build from source:

```bash
git clone https://github.com/axellopezuy-cmd/real-time.git
cd real-time
./build.sh
cp target/release/realtime ~/.local/bin/
```

## How it works

```
Editor (auto-save) → inotify (zero debounce) → Rust server → WebSocket → Browser (DOM morphing)
```

1. You save a file (or your editor auto-saves)
2. inotify detects the change instantly (no polling, no debounce)
3. Rust server reads the file and broadcasts raw content over WebSocket
4. Browser receives the delta, diffs the DOM, and updates only what changed

Result: **< 50ms** from keystroke to screen. No flicker, no full reload.

## Features

- **One command** — `realtime .` and you're working
- **Zero config** — no webpack, no bundler, no node_modules
- **Real rendering** — full HTML/CSS in an iframe, not a simulation
- **DOM morphing** — only changed nodes update, preserving scroll and form state
- **WASM parser** — 33KB HTML/CSS parser compiled to WebAssembly for overlay analysis
- **Built-in inspector** — toggle Outlines and Labels overlays like Chrome DevTools
- **Delta updates** — only changed files are sent over WebSocket
- **Auto-reconnect** — WebSocket reconnects automatically if connection drops
- **Cross-platform** — Linux, macOS, Windows

## Usage

```bash
# Watch current directory
realtime

# Watch a specific folder
realtime ./src

# Custom port, don't open browser
realtime ./src --port 8080 --no-open
```

## Tech stack

- **Rust** — server, file watcher, parsers
- **Axum** — HTTP server with WebSocket support
- **inotify** — zero-debounce file watching
- **WebAssembly** — HTML/CSS parsers in the browser (33KB gzip)
- **rust-embed** — frontend bundled into the binary
- **DOM morphing** — custom diffing algorithm, no virtual DOM library

## Development

```bash
# Run tests
cargo test --workspace
cd panel-browser && npm test

# Full build
./build.sh

# Dev mode (panel-browser)
cd panel-browser && npm run dev
```

## License

Apache 2.0
