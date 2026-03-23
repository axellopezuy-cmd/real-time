# Implementation Plan: PSDOM

## Overview

Implementar PSDOM como módulo TypeScript en el panel-browser, compuesto por tres piezas ortogonales (SelectorResolver, SpecificityCalculator, InheritanceResolver) más un orquestador. Integrar con el LayoutEngine existente reemplazando el matchDirectives simple.

## Tasks

- [x] 1. Implementar SpecificityCalculator como función pura
  - [x] 1.1 Crear `panel-browser/src/psdom/specificity.ts` con `calculateSpecificity`, `compareSpecificity` y `resolveBySpecificity`
    - Implementar parsing de selectores para contar IDs (a), clases/atributos/pseudoclases (b), elementos/pseudoelementos (c)
    - Manejar `:not()` recursivamente (contar interior, no contar el :not mismo)
    - Implementar comparación lexicográfica de tuplas
    - Implementar resolución: mayor especificidad gana, empate → última declaración gana
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.2 Write property test: Especificidad matemática correcta
    - **Property 4: Especificidad matemática correcta**
    - Generar selectores con cantidades conocidas de IDs, clases y elementos
    - Verificar que la tupla retornada matchea los conteos
    - **Validates: Requirements 2.1**

  - [x] 1.3 Write property test: Cascada — mayor especificidad o última declaración gana
    - **Property 5: Cascada — mayor especificidad o última declaración gana**
    - Generar pares de directrices con especificidades distintas para mismo nodo/propiedad
    - Verificar que la de mayor especificidad gana, o la última si empatan
    - **Validates: Requirements 2.2, 2.3, 5.3**

- [x] 2. Implementar InheritanceResolver
  - [x] 2.1 Crear `panel-browser/src/psdom/inheritance.ts` con `isInheritable`, `resolveInheritance`, constantes `INHERITABLE_PROPERTIES` y `CSS_DEFAULTS`
    - Implementar set de propiedades heredables
    - Implementar búsqueda en cadena de ancestros
    - Implementar fallback a defaults CSS
    - Valor explícito tiene prioridad sobre herencia
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Write property test: Herencia — explícito > ancestro > default
    - **Property 6: Herencia — explícito > ancestro > default**
    - Generar árboles con directrices en distintos niveles de profundidad
    - Verificar prioridad: explícito > ancestro más cercano > default
    - **Validates: Requirements 3.1, 3.4**

- [x] 3. Implementar SelectorResolver con iframe aislado
  - [x] 3.1 Crear `panel-browser/src/psdom/selector-resolver.ts` con clase `SelectorResolver`
    - Implementar creación de iframe permanente invisible
    - Implementar `buildTree` que construye DOM desde ObjetoHtml[] con data-rt-id
    - Implementar `matchSelector` con try/catch para validación defensiva
    - Implementar `cleanup` que limpia innerHTML del iframe
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3_

  - [x] 3.2 Write property test: Construcción fidedigna del árbol PSDOM
    - **Property 1: Construcción fidedigna del árbol PSDOM**
    - Generar árboles de ObjetoHtml con atributos variados
    - Verificar biyección data-rt-id ↔ ObjetoHtml.id y preservación de tag/atributos
    - **Validates: Requirements 1.1, 1.7**

  - [x] 3.3 Write property test: Validación defensiva — selector inválido descartado sin interrumpir
    - **Property 7: Validación defensiva — selector inválido descartado sin interrumpir**
    - Generar listas mixtas de selectores válidos e inválidos
    - Verificar que los inválidos se descartan y los válidos se procesan correctamente
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 4. Checkpoint - Verificar que las tres piezas pasan tests independientemente
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implementar PSDOM Orchestrator
  - [x] 5.1 Crear `panel-browser/src/psdom/psdom.ts` con clase `PSDOM` y tipos `SelectorResult`, `ResolvedDirectives`, `DirectiveConflict`
    - Implementar método `resolve(objects, directives)` que orquesta las tres piezas
    - Implementar detección de conflictos multi-archivo
    - Implementar walkTree para herencia recursiva
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

  - [x] 5.2 Crear `panel-browser/src/psdom/index.ts` como barrel export del módulo
    - Exportar PSDOM, calculateSpecificity, compareSpecificity, resolveBySpecificity, isInheritable, resolveInheritance, SelectorResolver
    - Exportar tipos: Specificity, SelectorResult, ResolvedDirectives, DirectiveConflict
    - _Requirements: 7.1, 7.3_

  - [x] 5.3 Write property test: Ciclo stateless sin contaminación
    - **Property 3: Ciclo stateless sin contaminación**
    - Ejecutar dos ciclos consecutivos con inputs distintos
    - Verificar que el segundo produce resultados idénticos a ejecutarlo como primer ciclo
    - **Validates: Requirements 1.6, 6.2, 6.3**

  - [x] 5.4 Write property test: Detección de conflictos multi-archivo
    - **Property 8: Detección de conflictos multi-archivo**
    - Generar directrices de múltiples selectores apuntando al mismo nodo/propiedad
    - Verificar que se reporta conflicto con candidatos correctos
    - **Validates: Requirements 5.1, 5.2**

- [x] 6. Integrar PSDOM con LayoutEngine
  - [x] 6.1 Modificar `panel-browser/src/layout-engine.ts` para usar PSDOM en vez de matchDirectives
    - Reemplazar `matchDirectives` privado por llamada a PSDOM.resolve
    - Consumir el mapa pre-resuelto para asignar directrices a cada LayoutNode
    - Mantener la interfaz pública de LayoutEngine sin cambios
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.2 Write property test: Compatibilidad hacia atrás con selectores simples
    - **Property 9: Compatibilidad hacia atrás con selectores simples**
    - Generar árboles y directrices con selectores simples (tag, .class, #id)
    - Verificar que PSDOM produce el mismo matching que el matchDirectives original
    - **Validates: Requirements 7.2**

- [x] 7. Actualizar exports del panel-browser
  - Agregar exports de PSDOM en `panel-browser/src/index.ts`
  - _Requirements: 7.3_

- [x] 8. Final checkpoint - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Todos los property tests son obligatorios
- Cada task referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Property tests validan propiedades universales de correctitud
- Unit tests validan ejemplos específicos y edge cases
- El SelectorResolver requiere entorno con DOM (happy-dom o jsdom en vitest)
- SpecificityCalculator e InheritanceResolver son funciones puras testeables sin DOM
- El orden de cascada depende del orden de fusión del Consolidator (alfabético por path)
