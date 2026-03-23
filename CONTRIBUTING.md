# Contribuir a Real Time

## Requisitos

- Rust (stable, 1.70+)
- Node.js (20+)
- npm

## Compilar

```bash
./build.sh
```

## Tests

```bash
# Rust (parser, relay, consolidator, CLI)
cargo test --workspace

# TypeScript (PSDOM, layout, renderer)
cd panel-browser && npm test
```

## Agregar una propiedad CSS

1. Si es una propiedad que afecta layout o visibilidad:
   - Editar `panel-browser/src/directive-applicator.ts` — agregar case en `applyDirective`
   - Si necesita campo nuevo en `LayoutNode`, agregarlo en `panel-browser/src/types.ts`

2. Si es una propiedad visual (solo rendering):
   - Editar `panel-browser/src/box-renderer.ts` — leer de `node.directives` en `renderNode`
   - Agregar campo opcional a `RenderCommand` si es necesario

3. Si es una propiedad heredable:
   - Agregar al set `INHERITABLE_PROPERTIES` en `panel-browser/src/psdom/inheritance.ts`
   - Agregar valor default en `CSS_DEFAULTS`

4. Agregar tests correspondientes en `panel-browser/src/__tests__/`

## Estructura del proyecto

```
shared/          — Tipos compartidos (ObjetoHtml, Directriz, RenderMessage)
parser/          — Parser de HTML y CSS (Rust)
relay/           — WebSocket relay server (Rust)
realtime-cli/    — CLI principal con file watcher y consolidator (Rust)
panel-browser/   — Frontend: PSDOM, layout engine, renderer (TypeScript)
```
