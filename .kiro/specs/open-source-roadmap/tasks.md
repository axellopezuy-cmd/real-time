# Implementation Plan — Real Time: Roadmap hacia Open Source

## Overview

Implementar los cambios necesarios para llevar Real Time desde MVP con PSDOM implementado hasta producto open source descargable. Las fases 1.1-1.4 del roadmap (PSDOM completo) ya están hechas. Este plan arranca desde 1.5.

## Tasks

- [x] 1. Agregar source_file a Directriz (cross-crate)
  - [x] 1.1 Agregar campo `source_file: Option<String>` a `Directriz` en `shared/src/lib.rs`
  - [x] 1.2 Propagar source_file en el Consolidator
  - [x] 1.3 Write property test: source_file round-trip por archivo (Rust)
  - [x] 1.4 Write property test: Independencia parser/consolidator (Rust)
  - [x] 1.5 Actualizar tipos TypeScript
  - [x] 1.6 Actualizar detección de conflictos en PSDOM
  - [x] 1.7 Verificar que los 46 tests de PSDOM siguen pasando

- [x] 2. Selectores agrupados en CSS Parser
  - [x] 2.1 Implementar expansión de selectores agrupados en `parser/src/css_parser.rs`
  - [x] 2.2 Actualizar pretty printer para agrupar directrices con mismas declaraciones
  - [x] 2.3 Write property test: Expansión de selectores agrupados (Rust)
  - [x] 2.4 Write property test: Round-trip de selectores agrupados (Rust)
  - [x] 2.5 Write property test: Tolerancia a ramas inválidas (Rust)

- [x] 3. Checkpoint — Núcleo CSS completo

- [x] 4. Integrar PSDOM en el Panel Browser
  - [x] 4.1 Reescribir `panel-browser/index.html` para usar PSDOM + WebSocketClient

- [x] 5. Propiedades CSS adicionales en DirectiveApplicator
  - [x] 5.1 Agregar `hidden?: boolean` a `LayoutNode` en `panel-browser/src/types.ts`
  - [x] 5.2 Implementar nuevas propiedades en `panel-browser/src/directive-applicator.ts`
  - [x] 5.3 Actualizar LayoutEngine para excluir nodos hidden del output
  - [x] 5.4 Write property test: display:none elimina del layout
  - [x] 5.5 Write property test: max-width restringe sin exceder
  - [x] 5.6 Write property test: Propiedad inválida preserva estado

- [x] 6. Mejoras visuales del BoxRenderer
  - [x] 6.1 Extender `RenderCommand` con campos opcionales
  - [x] 6.2 Actualizar `renderNode` para leer directrices visuales
  - [x] 6.3 Actualizar `renderToCanvas` para usar `ctx.roundRect()`, `ctx.globalAlpha`, etc.
  - [x] 6.4 Actualizar colores de zona

- [x] 7. Canvas responsivo
  - [x] 7.1 Implementar resize handler en `panel-browser/index.html`
  - [x] 7.2 Write property test: Layout determinista por dimensiones
  - [x] 7.3 Write property test: Contenido dentro de los límites del canvas

- [x] 8. Indicadores de estado en el Panel
  - [x] 8.1 Extender status bar en `panel-browser/index.html`

- [x] 9. Checkpoint — Panel completo

- [x] 10. Build pipeline
  - [x] 10.1 Crear `build.sh`
  - [x] 10.2 Crear `.github/workflows/ci.yml`
  - [x] 10.3 Crear `install.sh`

- [x] 11. Tests de integración end-to-end
  - [x] 11.1 Crear tests E2E en Rust
  - [x] 11.2 Write property test: Orden determinista del Consolidator (Rust)

- [x] 12. Checkpoint — Robustez completa

- [x] 13. Documentación para lanzamiento
  - [x] 13.1 Crear README.md
  - [x] 13.2 Crear CONTRIBUTING.md
  - [x] 13.3 Pulir documentación técnica existente

- [ ] 14. Final checkpoint — Listo para validación con usuarios
  - Verificar: binario funciona en Linux, macOS Intel, macOS ARM, Windows
  - Verificar: un proyecto HTML+CSS real se visualiza correctamente
  - Criterio: un dev externo puede usar Real Time durante una hora sin encontrar un límite bloqueante

## Notes

- Todos los property tests son obligatorios — no hay tasks opcionales
- Properties 3 y 4 del diseño ya están implementadas en los tests de PSDOM existentes — no se reimplementan
- El orden de las fases es secuencial: cada checkpoint valida antes de avanzar
- Los 47 tests de PSDOM/panel-browser siguen pasando
- El campo `source_file` en Directriz es `Option` con `serde(default)` — no rompe serialización existente
- La Fase 4 del roadmap (validación con usuarios reales) es un proceso externo al código — no tiene tasks de implementación aquí
