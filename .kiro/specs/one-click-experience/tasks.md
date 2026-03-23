# Implementation Plan: One-Click Experience

## Overview

Transformar Real Time en un binario único ejecutable. Se refactoriza el proyecto para unificar relay + parser + file watcher + panel server en un solo crate `realtime-cli`, se embeben los assets del panel browser, y se implementa el arranque automático con un solo comando.

## Tasks

- [x] 1. Reestructurar workspace y crear crate `realtime-cli`
  - Agregar crate `realtime-cli` al workspace Cargo
  - Agregar dependencias: `notify`, `webbrowser`, `clap`, `axum`, `tower-http`, `rust-embed`, `ctrlc`, `tempdir` (dev)
  - Mover la lógica de `parser/src/main.rs` y `relay/src/main.rs` al nuevo crate
  - _Requirements: 1.1, 1.3_

- [x] 2. Implementar CLI argument parsing
  - [x] 2.1 Implementar parsing de argumentos con clap
    - Argumento posicional opcional: directorio de trabajo (default: cwd)
    - Opciones: `--port`, `--relay`, `--no-open`, `--help`, `--version`
    - Resolver paths relativos a absolutos
    - Validar que el directorio existe
    - _Requirements: 1.4, 1.5_

  - [x] 2.2 Write property test: CLI directory resolution
    - **Property 1: CLI directory resolution**
    - **Validates: Requirements 1.4, 1.5**

- [x] 3. Implementar Project Scanner
  - [x] 3.1 Implementar scan recursivo de archivos HTML/CSS
    - Walk recursivo del directorio de trabajo
    - Filtrar solo `.html` y `.css`
    - Excluir directorios ignorados: `node_modules`, `.git`, `target`, `dist`, `build`
    - _Requirements: 3.1, 3.5_

  - [x] 3.2 Write property test: Recursive file scanning
    - **Property 3: Recursive file scanning finds all HTML/CSS**
    - **Validates: Requirements 3.1**

  - [x] 3.3 Write property test: Ignored directories excluded
    - **Property 6: Ignored directories are excluded from scanning**
    - **Validates: Requirements 3.5**

- [x] 4. Implementar MessageConsolidator
  - [x] 4.1 Implementar consolidación multi-archivo
    - HashMap de PathBuf → ParsedFile
    - Método `update_file`: upsert de un archivo parseado
    - Método `remove_file`: eliminar un archivo
    - Método `consolidate`: combinar todos los objetos y directrices en un RenderMessage
    - Agregar `source_file` a ObjetoHtml para trazar origen
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Write property test: Consolidation includes all objects and directives
    - **Property 7: Consolidation includes all objects and directives**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 4.3 Write property test: File upsert updates consolidated message
    - **Property 4: File upsert updates consolidated message**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 4.4 Write property test: File deletion removes from consolidated message
    - **Property 5: File deletion removes from consolidated message**
    - **Validates: Requirements 3.4**

  - [x] 4.5 Write property test: Incremental update preserves other files
    - **Property 8: Incremental update preserves other files**
    - **Validates: Requirements 5.3**

- [x] 5. Checkpoint - Core logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar File Watcher
  - [x] 6.1 Implementar file watcher con notify crate
    - Observar recursivamente el directorio de trabajo
    - Filtrar eventos solo para `.html` y `.css`
    - Ignorar directorios excluidos
    - Debounce de 100ms para agrupar cambios rápidos
    - Al detectar cambio: re-parsear archivo → actualizar consolidator → enviar al relay
    - Al detectar creación: agregar al consolidator
    - Al detectar eliminación: remover del consolidator
    - _Requirements: 3.2, 3.3, 3.4, 3.6_

  - [x] 6.2 Write unit tests para file watcher
    - Test con directorio temporal: crear archivo, verificar evento
    - Test con directorio temporal: modificar archivo, verificar re-parsing
    - Test con directorio temporal: eliminar archivo, verificar remoción
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 7. Implementar Panel Server embebido
  - [x] 7.1 Embeber assets del Panel Browser en el binario
    - Usar `rust-embed` para incluir los archivos compilados del panel browser
    - Implementar servidor HTTP con axum que sirva los assets embebidos
    - Ruta GET / → index.html
    - Ruta GET /assets/* → JS/CSS
    - _Requirements: 4.1_

  - [x] 7.2 Implementar detección de puerto disponible
    - Intentar bind en el puerto solicitado
    - Si falla, incrementar y reintentar (máximo 100 intentos)
    - _Requirements: 2.4_

  - [x] 7.3 Write property test: Port fallback on conflict
    - **Property 2: Port fallback on conflict**
    - **Validates: Requirements 2.4**

- [x] 8. Implementar Launcher
  - [x] 8.1 Implementar orquestador de arranque
    - Arrancar relay server como tokio task
    - Arrancar panel server como tokio task
    - Arrancar file watcher como tokio task
    - Ejecutar scan inicial y enviar primer RenderMessage
    - Abrir browser con `webbrowser::open`
    - Mostrar mensaje en terminal con URL y directorio
    - Manejar Ctrl+C para shutdown limpio
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 4.2_

  - [x] 8.2 Write integration tests para Launcher
    - Test arranque completo con directorio temporal
    - Test shutdown limpio
    - _Requirements: 2.1, 2.5_

- [x] 9. Checkpoint - Binario funcional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Actualizar Panel Browser para multi-archivo
  - [x] 10.1 Agregar indicador de source_file en las cajas
    - Mostrar el nombre del archivo origen como tooltip o sub-label en cada caja
    - Mostrar contador de archivos observados en el status bar
    - _Requirements: 5.4, 4.3_

  - [x] 10.2 Compilar Panel Browser para embedding
    - Configurar build del panel browser que produzca archivos estáticos listos para embeber
    - _Requirements: 4.1_

- [x] 11. Refactorizar main.rs del CLI
  - [x] 11.1 Unificar todo en el binario `realtime`
    - El `main.rs` del crate `realtime-cli` parsea args → crea Launcher → arranca
    - Eliminar los binarios separados de parser y relay (quedan como library crates)
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Todas las tareas son obligatorias
- Cada task referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Property tests validan propiedades universales de correctitud
- El resultado final es un solo binario `realtime` que el dev ejecuta y está listo
