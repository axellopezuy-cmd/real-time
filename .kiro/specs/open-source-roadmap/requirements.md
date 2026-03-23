# Requirements Document — Real Time: Roadmap hacia Open Source

## Introduction

Este documento define los requisitos para llevar Real Time desde su estado actual de MVP funcional hasta un producto open source que un desarrollador externo pueda descargar, apuntar a su proyecto real con HTML y CSS moderadamente complejos, y usar durante una hora de trabajo sin encontrar un límite que le impida continuar.

El PSDOM ya está implementado y testeado (46 tests, 9 propiedades de correctitud). Lo que falta es: propagar `source_file` en Directriz, conectar PSDOM en el panel real, polish visual, robustez cross-platform, y documentación para lanzamiento.

## Glossary

- **Real_Time**: Plataforma que genera una representación visual fidedigna del código front-end en tiempo real.
- **Panel_Browser**: Aplicación web que renderiza la representación visual en un canvas HTML5.
- **PSDOM**: Módulo Proxy Shadow DOM que resuelve selector matching, especificidad, cascada y herencia CSS.
- **Directriz**: Instrucción de estilo derivada del código CSS del desarrollador.
- **ObjetoHtml**: Representación interna de una etiqueta HTML como caja geométrica.
- **RenderMessage**: Mensaje que transporta objetos HTML y directrices CSS del parser al panel browser.
- **Consolidator**: Módulo Rust que fusiona múltiples archivos parseados en un solo RenderMessage.
- **Relay**: Servidor WebSocket que retransmite mensajes sin modificarlos (conducto ciego).
- **LayoutEngine**: Motor que calcula posiciones y zonas predilectas para cada ObjetoHtml.
- **DirectiveApplicator**: Módulo que aplica directrices CSS sobre LayoutNodes modificando posición y dimensiones.
- **BoxRenderer**: Módulo que genera comandos de dibujo a partir de LayoutNodes.
- **CSS_Parser**: Parser tolerante a errores que convierte CSS en lista de Directrices.
- **Binario**: Ejecutable único `realtime` que incluye CLI, parser, relay, file watcher y panel embebido.

## Requirements

### Requirement 1: Propagación de source_file en Directriz

**User Story:** As a developer, I want each CSS directive to carry its source file origin, so that conflict detection can report exactly which files are competing.

#### Acceptance Criteria

1. THE Directriz struct in the shared crate SHALL include an optional `source_file` field
2. WHEN the CSS_Parser parses a CSS file, THE CSS_Parser SHALL NOT set `source_file` on Directrices (the parser does not know the file path)
3. WHEN the Consolidator merges files, THE Consolidator SHALL set `source_file` on each Directriz with the filename of the originating file
4. THE TypeScript Directriz interface SHALL include an optional `source_file` field matching the Rust struct
5. WHEN PSDOM detects a conflict between Directrices with different `source_file` values, THE PSDOM SHALL include the `source_file` in the conflict report
6. WHEN existing tests are run after the change, THE system SHALL pass all 46 existing TypeScript tests and all existing Rust tests without modification

### Requirement 2: Integración de PSDOM en el Panel Browser

**User Story:** As a developer, I want the panel browser to use PSDOM for CSS resolution, so that complex selectors, specificity, and inheritance work correctly in the visual representation.

#### Acceptance Criteria

1. WHEN the Panel_Browser receives a RenderMessage, THE Panel_Browser SHALL use PSDOM.resolve() to produce the directive map before passing it to the LayoutEngine
2. THE Panel_Browser SHALL use the WebSocketClient class instead of inline WebSocket code
3. WHEN the Panel_Browser starts, THE Panel_Browser SHALL instantiate PSDOM once and reuse it across RenderMessages
4. WHEN the Panel_Browser shuts down or disconnects permanently, THE Panel_Browser SHALL call PSDOM.destroy() to clean up the iframe
5. THE Panel_Browser SHALL display the count of invalid selectors and detected conflicts in the status bar

### Requirement 3: Selectores CSS agrupados en el Parser

**User Story:** As a developer, I want the CSS parser to handle grouped selectors (`h1, h2 {}`), so that real-world CSS files parse correctly.

#### Acceptance Criteria

1. WHEN the CSS_Parser encounters a grouped selector (comma-separated), THE CSS_Parser SHALL emit one Directriz per selector per declaration
2. WHEN the CSS_Parser encounters a grouped selector with invalid syntax in one branch, THE CSS_Parser SHALL still emit Directrices for the valid branches
3. THE CSS_Parser pretty printer SHALL format grouped selectors back into valid CSS
4. FOR ALL valid CSS with grouped selectors, parsing then pretty-printing then parsing SHALL produce equivalent Directrices (round-trip property)

### Requirement 4: Propiedades CSS adicionales en DirectiveApplicator

**User Story:** As a developer, I want the directive applicator to handle common CSS layout properties, so that the visual representation reflects real CSS styling.

#### Acceptance Criteria

1. THE DirectiveApplicator SHALL apply `padding` (top, right, bottom, left) by adjusting child positioning within the parent box
2. THE DirectiveApplicator SHALL apply `display: none` by hiding the node and its children from the layout
3. THE DirectiveApplicator SHALL apply `border-radius` by storing the value for the BoxRenderer to use
4. THE DirectiveApplicator SHALL apply `opacity` by storing the value for the BoxRenderer to use
5. THE DirectiveApplicator SHALL apply `max-width` and `min-height` by constraining dimensions
6. THE DirectiveApplicator SHALL apply `font-size` and `color` by storing values for the BoxRenderer to use
7. IF a property value has invalid syntax, THEN THE DirectiveApplicator SHALL ignore it and preserve the current state

### Requirement 5: Mejoras visuales del BoxRenderer

**User Story:** As a developer, I want the visual representation to look polished and informative, so that I can quickly understand the structure of my page.

#### Acceptance Criteria

1. THE BoxRenderer SHALL render border-radius on boxes when the directive is present
2. THE BoxRenderer SHALL apply opacity to boxes when the directive is present
3. THE BoxRenderer SHALL render border color and width when border directives are present
4. THE BoxRenderer SHALL use distinguishable and visually pleasant zone colors
5. THE BoxRenderer SHALL display font-size and color values visually on text labels when present

### Requirement 6: Canvas responsivo

**User Story:** As a developer, I want the canvas to adapt to my browser window size, so that I can see the representation at any viewport size.

#### Acceptance Criteria

1. WHEN the browser window is resized, THE Panel_Browser SHALL resize the canvas to fill the available viewport
2. WHEN the canvas is resized, THE LayoutEngine SHALL recompute layout using the new dimensions
3. THE Panel_Browser SHALL debounce resize events to avoid excessive recomputation

### Requirement 7: Indicadores de estado en el Panel

**User Story:** As a developer, I want to see connection status and diagnostic information, so that I know the system is working and can identify issues.

#### Acceptance Criteria

1. THE Panel_Browser SHALL display connection status (Connected, Reconnecting, Disconnected)
2. THE Panel_Browser SHALL display the count of observed files, objects, and directives
3. THE Panel_Browser SHALL display the count of invalid selectors discarded by PSDOM
4. THE Panel_Browser SHALL display the count of CSS conflicts detected by PSDOM
5. WHEN a conflict is detected, THE Panel_Browser SHALL visually indicate the affected boxes

### Requirement 8: Build pipeline para embedding

**User Story:** As a developer building Real Time, I want the panel browser to be compiled and embedded in the Rust binary automatically, so that the binary is self-contained.

#### Acceptance Criteria

1. WHEN `vite build` is run in the panel-browser directory, THE build system SHALL produce a `dist/` directory with all assets
2. WHEN `cargo build` is run for realtime-cli, THE build system SHALL embed the panel-browser dist assets via rust-embed
3. THE Binario SHALL serve the embedded panel correctly on all target platforms
4. IF the `dist/` directory is missing or stale, THEN the build process SHALL produce a clear error message

### Requirement 9: Compilación cross-platform

**User Story:** As a developer, I want to download a pre-built binary for my platform, so that I can use Real Time without compiling from source.

#### Acceptance Criteria

1. THE CI system SHALL compile binaries for x86_64-unknown-linux-gnu, x86_64-apple-darwin, aarch64-apple-darwin, and x86_64-pc-windows-msvc
2. THE Binario SHALL function without external dependencies on each target platform
3. WHEN a push is made to the main branch, THE CI system SHALL run all tests (Rust and TypeScript) before producing binaries
4. THE CI system SHALL publish binaries as GitHub Release assets with semantic versioning

### Requirement 10: Script de instalación

**User Story:** As a developer, I want a one-line install command, so that I can start using Real Time immediately.

#### Acceptance Criteria

1. THE install script SHALL detect the operating system and architecture automatically
2. THE install script SHALL download the correct binary from GitHub Releases
3. THE install script SHALL add the binary to the user's PATH or provide instructions to do so
4. IF the download fails, THEN THE install script SHALL display a clear error message with manual download instructions

### Requirement 11: Tests de integración end-to-end

**User Story:** As a developer contributing to Real Time, I want end-to-end tests that verify the full pipeline, so that regressions are caught before release.

#### Acceptance Criteria

1. THE test suite SHALL include a test with real HTML+CSS that uses CSS combinators and verifies PSDOM resolves them correctly through the full pipeline
2. THE test suite SHALL include a test with invalid selectors mixed with valid ones and verify graceful handling
3. THE test suite SHALL include a test with multiple CSS files that have conflicting directives and verify conflict detection
4. THE test suite SHALL include a test that verifies the Consolidator preserves alphabetical file order for cascade determinism

### Requirement 12: Documentación para lanzamiento

**User Story:** As a developer discovering Real Time, I want clear documentation, so that I can understand what it is, install it, and start using it within minutes.

#### Acceptance Criteria

1. THE README SHALL explain what Real Time is in two paragraphs or less
2. THE README SHALL include a visual demonstration (GIF or video) of the complete workflow
3. THE README SHALL include installation instructions in three commands or less
4. THE README SHALL include basic usage instructions
5. THE README SHALL include honest limits of what the system does and does not do
6. THE repository SHALL include a CONTRIBUTING guide with instructions for running tests, compiling, and adding features
7. THE repository SHALL include SPEC.md, design.md, and requirements.md as technical documentation

### Requirement 13: Validación con usuarios reales

**User Story:** As the product owner, I want external developers to validate the product before public launch, so that critical blockers are identified and resolved.

#### Acceptance Criteria

1. WHEN ten external developers use the binary on their real projects for one week, THE team SHALL collect feedback on first impression, limits encountered, and workflow
2. WHEN critical blockers are identified from user feedback, THE team SHALL resolve them before making the repository public
3. THE launch criterion SHALL be: a developer can use Real Time on a moderately complex HTML/CSS project for one hour without hitting a blocking limit
