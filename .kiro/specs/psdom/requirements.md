# Requirements Document

## Introduction

PSDOM (Proxy Shadow DOM) es un módulo del Panel Browser que delega al motor nativo del navegador la resolución de selectores CSS complejos, y complementa esa delegación con cálculo de especificidad y resolución de herencia propios. Reemplaza el selector matching simple actual del LayoutEngine (que solo resuelve tag, .class y #id) por un sistema que soporta combinadores, pseudoclases estructurales, especificidad, cascada y herencia — sin reimplementar el motor CSS del browser.

PSDOM se compone de tres piezas ortogonales: un SelectorResolver que usa un iframe aislado para querySelectorAll nativo, un SpecificityCalculator que resuelve cascada como función matemática pura, y un InheritanceResolver que propaga propiedades heredables recorriendo el árbol de ObjetoHtml. Cada pieza es independiente, testeable por separado y reemplazable sin afectar las otras.

El módulo mantiene el principio stateless del sistema: el contenido del iframe se limpia en cada RenderMessage, aunque el iframe como contenedor persiste para evitar el costo de creación/destrucción.

## Glossary

- **PSDOM**: Módulo orquestador que coordina SelectorResolver, SpecificityCalculator e InheritanceResolver para resolver la aplicación completa de Directrices sobre el árbol de ObjetoHtml.
- **SelectorResolver**: Componente que construye un árbol DOM dentro de un iframe aislado desde ObjetoHtml y usa querySelectorAll nativo para resolver selectores CSS complejos.
- **SpecificityCalculator**: Función pura que calcula la especificidad de un selector CSS como tupla (a, b, c) y determina qué Directriz gana cuando múltiples apuntan al mismo nodo y propiedad.
- **InheritanceResolver**: Componente que recorre el árbol de ObjetoHtml hacia los ancestros para propagar propiedades CSS heredables cuando un nodo no tiene valor explícito.
- **Iframe_Aislado**: Elemento iframe con srcdoc vacío que vive permanentemente en el Panel_Browser, invisible y aislado del DOM principal, usado exclusivamente como entorno de ejecución para querySelectorAll.
- **Objeto_Html**: Representación interna de una etiqueta HTML como caja geométrica en el panel de visualización (definido en spec MVP).
- **Directriz**: Instrucción de estilo derivada del código CSS del desarrollador (definido en spec MVP).
- **LayoutNode**: Nodo del árbol de layout con posición, dimensiones y directrices aplicadas (definido en spec MVP).
- **Propiedad_Heredable**: Propiedad CSS que se propaga de padre a hijo cuando el hijo no tiene valor explícito (color, font-family, font-size, line-height, etc.).
- **Especificidad**: Peso de un selector CSS representado como tupla (a, b, c) donde a = IDs, b = clases/atributos/pseudoclases, c = elementos/pseudoelementos.

## Requirements

### Requirement 1: Resolución de Selectores Complejos

**User Story:** Como desarrollador, quiero que las directrices CSS con selectores complejos (combinadores, pseudoclases, atributos) se apliquen correctamente a los Objetos_Html correspondientes, para que la representación visual refleje fielmente la estructura CSS que escribo.

#### Acceptance Criteria

1. WHEN el SelectorResolver recibe un árbol de ObjetoHtml y una lista de Directrices, THE SelectorResolver SHALL construir un árbol DOM equivalente dentro del Iframe_Aislado preservando tag, id, class y todos los atributos de cada ObjetoHtml.
2. WHEN el SelectorResolver ejecuta querySelectorAll con un selector de combinador (e.g. `div > p`, `ul li`, `h1 + p`), THE SelectorResolver SHALL retornar los IDs de todos los ObjetoHtml que matchean según la semántica CSS estándar.
3. WHEN el SelectorResolver ejecuta querySelectorAll con una pseudoclase estructural (e.g. `:nth-child(2)`, `:first-of-type`, `:last-child`), THE SelectorResolver SHALL retornar los IDs correctos basándose en la posición real de cada nodo en el árbol.
4. WHEN el SelectorResolver ejecuta querySelectorAll con `:not()`, THE SelectorResolver SHALL retornar los IDs de los nodos que no matchean el selector interno.
5. WHEN el SelectorResolver ejecuta querySelectorAll con selectores de atributo (e.g. `[data-role="main"]`, `[href^="https"]`), THE SelectorResolver SHALL retornar los IDs correctos basándose en los atributos del ObjetoHtml.
6. WHEN el SelectorResolver completa la resolución de todas las Directrices, THE SelectorResolver SHALL limpiar el contenido del Iframe_Aislado para mantener el principio stateless.
7. THE SelectorResolver SHALL mantener una correspondencia biunívoca entre nodos del Iframe_Aislado y ObjetoHtml mediante el atributo data-rt-id, de modo que cada resultado de querySelectorAll se mapee de vuelta al ObjetoHtml original.

### Requirement 2: Cálculo de Especificidad y Cascada

**User Story:** Como desarrollador, quiero que cuando dos o más directrices apunten al mismo nodo y la misma propiedad, el sistema aplique la de mayor especificidad según las reglas CSS estándar, para que la representación visual sea predecible y consistente con CSS real.

#### Acceptance Criteria

1. THE SpecificityCalculator SHALL calcular la especificidad de un selector CSS como tupla (a, b, c) donde a cuenta selectores de ID, b cuenta selectores de clase, atributo y pseudoclase, y c cuenta selectores de elemento y pseudoelemento.
2. WHEN dos Directrices apuntan al mismo nodo y la misma propiedad con distinta especificidad, THE SpecificityCalculator SHALL seleccionar la Directriz con mayor especificidad comparando las tuplas lexicográficamente (a > b > c).
3. WHEN dos Directrices apuntan al mismo nodo y la misma propiedad con igual especificidad, THE SpecificityCalculator SHALL seleccionar la Directriz que aparece última en el orden de declaración.
4. THE SpecificityCalculator SHALL operar como función pura sin dependencia de DOM ni estado externo.

### Requirement 3: Herencia de Propiedades CSS

**User Story:** Como desarrollador, quiero que las propiedades CSS heredables (color, font-family, font-size, line-height) se propaguen de padres a hijos en el árbol de ObjetoHtml, para que la representación visual refleje la herencia natural de CSS sin necesidad de declarar cada propiedad en cada elemento.

#### Acceptance Criteria

1. WHEN un ObjetoHtml no tiene una Directriz explícita para una Propiedad_Heredable, THE InheritanceResolver SHALL buscar el valor en la cadena de ancestros del árbol de ObjetoHtml y aplicar el primer valor encontrado.
2. WHEN ningún ancestro del ObjetoHtml tiene un valor para una Propiedad_Heredable, THE InheritanceResolver SHALL usar el valor por defecto de CSS para esa propiedad.
3. THE InheritanceResolver SHALL reconocer como heredables al menos las siguientes propiedades: color, font-family, font-size, font-weight, font-style, line-height, text-align, visibility, cursor, letter-spacing, word-spacing.
4. WHEN un ObjetoHtml tiene una Directriz explícita para una Propiedad_Heredable, THE InheritanceResolver SHALL usar el valor explícito sin buscar en ancestros.

### Requirement 4: Validación Defensiva de Selectores

**User Story:** Como desarrollador, quiero que el sistema distinga entre un selector CSS con sintaxis inválida y un selector válido que simplemente no matchea ningún elemento, para que los errores de sintaxis se filtren sin afectar selectores legítimos.

#### Acceptance Criteria

1. WHEN el SelectorResolver recibe un selector con sintaxis inválida, THE SelectorResolver SHALL detectar la excepción de querySelectorAll y descartar la Directriz silenciosamente.
2. WHEN el SelectorResolver recibe un selector válido que no matchea ningún nodo, THE SelectorResolver SHALL retornar una lista vacía de IDs sin descartar la Directriz.
3. IF el SelectorResolver encuentra un selector inválido, THEN THE SelectorResolver SHALL registrar el selector descartado para diagnóstico sin interrumpir el procesamiento de las demás Directrices.

### Requirement 5: Detección de Conflictos Multi-Archivo

**User Story:** Como desarrollador, quiero que el sistema detecte cuando dos archivos CSS definen la misma propiedad para el mismo selector con distinta especificidad, para que pueda identificar solapamientos entre mis archivos de estilos.

#### Acceptance Criteria

1. WHEN el PSDOM procesa Directrices de múltiples archivos CSS que apuntan al mismo nodo y la misma propiedad, THE PSDOM SHALL identificar los pares de Directrices en conflicto.
2. WHEN se detecta un conflicto entre Directrices de distintos archivos, THE PSDOM SHALL reportar el conflicto incluyendo los archivos origen, el selector, la propiedad y los valores en competencia.
3. THE PSDOM SHALL resolver el conflicto aplicando las reglas de especificidad y orden de declaración, usando la Directriz ganadora para la representación visual.

### Requirement 6: Ciclo de Vida Stateless del PSDOM

**User Story:** Como desarrollador, quiero que el PSDOM se reconstruya completamente en cada RenderMessage sin persistir estado entre ciclos, para que la representación visual sea siempre consistente con el código fuente actual.

#### Acceptance Criteria

1. WHEN el Panel_Browser recibe un nuevo RenderMessage, THE PSDOM SHALL ejecutar el ciclo completo: construir árbol en iframe, resolver selectores, calcular especificidad, resolver herencia, y limpiar el iframe.
2. THE PSDOM SHALL garantizar que ningún estado del ciclo anterior persista ni influya en el ciclo actual.
3. THE Iframe_Aislado SHALL existir permanentemente en el Panel_Browser como contenedor reutilizable, pero su contenido interno SHALL limpiarse al inicio de cada ciclo PSDOM.
4. WHEN el PSDOM completa un ciclo, THE PSDOM SHALL retornar un mapa de ID de ObjetoHtml a lista de Directrices resueltas (con especificidad y herencia aplicadas) que reemplaza el matching simple actual del LayoutEngine.

### Requirement 7: Integración con el Pipeline Existente

**User Story:** Como desarrollador del sistema, quiero que PSDOM se integre en el pipeline del Panel Browser sin romper la arquitectura existente, para que reemplace el selector matching simple del LayoutEngine de forma transparente.

#### Acceptance Criteria

1. THE PSDOM SHALL exponer una interfaz que reciba un árbol de ObjetoHtml y una lista de Directrices, y retorne un mapa de ID a Directrices resueltas compatible con el formato actual de LayoutNode.directives.
2. WHEN el PSDOM reemplaza el matchDirectives actual del LayoutEngine, THE LayoutEngine SHALL producir resultados idénticos para selectores simples (tag, .class, #id) que el matching anterior.
3. THE PSDOM SHALL operar como módulo independiente importable desde el LayoutEngine sin modificar las interfaces de ObjetoHtml, Directriz ni LayoutNode.
