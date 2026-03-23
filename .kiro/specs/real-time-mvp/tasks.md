# Implementation Plan: Real Time MVP

## Overview

Implementación incremental del MVP de Real Time. Se construye primero el núcleo en Rust (parsers + relay), luego el renderer en TypeScript, y finalmente se conecta todo. Cada paso valida funcionalidad con tests antes de avanzar.

## Tasks

- [x] 1. Inicializar proyecto Rust y estructura base
  - Crear workspace Cargo con crates: `parser`, `relay`, `shared`
  - Definir los data models (`ObjetoHtml`, `Directriz`, `RenderMessage`) en `shared`
  - Agregar dependencias: `html5ever`, `lightningcss`, `serde`, `serde_json`, `tokio`, `tokio-tungstenite`, `proptest`
  - _Requirements: 1.1, 3.1_

- [x] 2. Implementar Parser HTML
  - [x] 2.1 Implementar HTMLParser: parsear HTML string → árbol de ObjetoHtml
    - Usar `html5ever` para tokenizar y construir el árbol
    - Asignar IDs únicos a cada nodo
    - Manejar anidación correctamente
    - Ignorar sintaxis inválida (tolerancia a errores)
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.2 Implementar PrettyPrinter HTML: árbol de ObjetoHtml → HTML string
    - Recorrer el árbol y generar HTML válido con indentación
    - _Requirements: 1.5_

  - [x] 2.3 Write property test: HTML round-trip
    - **Property 2: HTML round-trip**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 2.4 Write property test: HTML parsing preserves structure
    - **Property 1: HTML parsing preserves structure**
    - **Validates: Requirements 1.1, 1.2**

  - [x] 2.5 Write property test: Tag removal produces correct tree
    - **Property 3: Tag removal produces correct tree**
    - **Validates: Requirements 1.3**

- [x] 3. Implementar Parser CSS
  - [x] 3.1 Implementar CSSParser: CSS string → lista de Directriz
    - Usar `lightningcss` para parsear reglas CSS
    - Extraer selector, propiedad y valor de cada declaración
    - Ignorar sintaxis inválida sin error
    - _Requirements: 3.1, 3.2_

  - [x] 3.2 Implementar PrettyPrinter CSS: lista de Directriz → CSS string
    - Generar CSS válido desde las directrices
    - _Requirements: 3.4_

  - [x] 3.3 Write property test: CSS round-trip
    - **Property 7: CSS round-trip**
    - **Validates: Requirements 3.4, 3.5**

  - [x] 3.4 Write property test: CSS parsing produces correct directives
    - **Property 6: CSS parsing produces correct directives**
    - **Validates: Requirements 3.1**

- [x] 4. Checkpoint - Parsers
  - All 25 Rust tests passing (18 unit + 7 property).

- [x] 5. Implementar Relay Server
  - [x] 5.1 Implementar WebSocket relay con tokio-tungstenite
    - Aceptar conexión de productor (Parser) y consumidor (Browser)
    - Retransmitir mensajes sin inspección ni transformación
    - Modelo push-only unidireccional
    - Manejar reconexión automática
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 5.2 Write property test: Relay transparency
    - **Property 11: Relay transparency**
    - **Validates: Requirements 5.1**

- [x] 6. Implementar Serialización y Pipeline IDE→Relay
  - [x] 6.1 Implementar serialización de RenderMessage a JSON
    - Conectar HTMLParser + CSSParser → RenderMessage
    - Serializar con serde_json
    - Enviar al Relay via WebSocket client
    - _Requirements: 1.1, 3.1, 5.1_

  - [x] 6.2 Write property test: Serialization round-trip de RenderMessage
    - Serializar y deserializar RenderMessage debe producir objeto equivalente
    - _Requirements: 5.1_

- [x] 7. Checkpoint - Backend Rust completo
  - All Rust tests passing.

- [x] 8. Inicializar proyecto Panel Browser (TypeScript)
  - Crear proyecto TypeScript con canvas HTML5
  - Agregar dependencias: `fast-check`, `vitest`
  - Definir interfaces TypeScript para ObjetoHtml, Directriz, RenderMessage, LayoutNode
  - Implementar WebSocketClient para recibir mensajes del Relay
  - _Requirements: 6.1_

- [x] 9. Implementar Motor de Layout
  - [x] 9.1 Implementar LayoutEngine con estructuración predilecta
    - Dividir canvas en zonas: top, center, bottom
    - Asignar zona según tag (header→top, nav→top, section→center, div→center, footer→bottom)
    - Posicionar elementos background al fondo con dimensiones completas
    - Calcular posiciones y dimensiones de cada LayoutNode
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 9.2 Implementar aplicación de Directrices sobre LayoutNodes
    - Modificar posición, dimensiones y apariencia según directrices CSS
    - Implementar re-inyección stateless: limpiar y recalcular desde cero en cada mensaje
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 9.3 Write property test: Semantic tag zone assignment
    - **Property 4: Semantic tag zone assignment**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [x] 9.4 Write property test: Background elements full-page positioning
    - **Property 5: Background elements full-page positioning**
    - **Validates: Requirements 2.6**

  - [x] 9.5 Write property test: Stateless rendering idempotence
    - **Property 10: Stateless rendering idempotence**
    - **Validates: Requirements 4.3, 4.4**

  - [x] 9.6 Write property test: Directive modification updates rendering state
    - **Property 8: Directive modification updates rendering state**
    - **Validates: Requirements 4.1**

  - [x] 9.7 Write property test: Directive removal reverts to base state
    - **Property 9: Directive removal reverts to base state**
    - **Validates: Requirements 4.2**

- [x] 10. Implementar Box Renderer
  - [x] 10.1 Implementar BoxRenderer en canvas HTML5
    - Dibujar cajas geométricas con bordes visibles
    - Agregar etiqueta de texto con el nombre del tag
    - Renderizar cajas hijas dentro de cajas padre respetando jerarquía
    - Ciclo stateless: limpiar canvas → aplicar layout → dibujar
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 10.2 Write property test: Box rendering includes identification
    - **Property 12: Box rendering includes identification**
    - **Validates: Requirements 6.1**

  - [x] 10.3 Write property test: Nested boxes spatial containment
    - **Property 13: Nested boxes spatial containment**
    - **Validates: Requirements 6.2**

- [x] 11. Checkpoint - Panel Browser completo
  - All 11 TypeScript tests passing (7 property + 4 integration).

- [x] 12. Integración end-to-end
  - [x] 12.1 Conectar Parser Module → Relay → Panel Browser
    - Implementar el flujo completo: código fuente → parse → serialize → relay → deserialize → layout → render
    - Implementar activación del relay bajo demanda
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 12.2 Write integration tests
    - Test flujo completo con HTML+CSS de ejemplo
    - Test tolerancia a errores end-to-end
    - Test reconexión tras desconexión
    - _Requirements: 1.4, 3.2, 5.4_

- [x] 13. Final checkpoint
  - All 36 tests passing (25 Rust + 11 TypeScript).
  - All 13 correctness properties validated.
  - All 6 requirements covered.

## Notes

- Todas las tareas completadas
- 25 tests Rust: 18 unit tests + 7 property tests (proptest, 100 iteraciones cada uno)
- 11 tests TypeScript: 7 property tests (fast-check, 100 iteraciones cada uno) + 4 integration tests
- 13 propiedades de correctitud validadas
- 6 requisitos cubiertos con trazabilidad completa
