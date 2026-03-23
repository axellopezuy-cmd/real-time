# Requirements Document

## Introduction

Real Time es una plataforma de desarrollo que genera una representación visual ficticia fidedigna del código front-end en tiempo real. Permite al desarrollador validar ideas de diseño durante la fase de estructuración y maquetación, sin depender del renderizado tradicional del navegador. El código fuente en el IDE es la fuente de verdad única; la representación visual es stateless y se reconstruye por re-inyección de directrices derivadas del código.

## Glossary

- **Real_Time_Platform**: La plataforma completa que conecta el IDE con el panel de visualización del browser.
- **Objeto_Html**: Representación interna de una etiqueta HTML como caja geométrica en el panel de visualización.
- **Directriz**: Instrucción de estilo derivada del código CSS del desarrollador. No es código persistido; solo modifica la representación visual.
- **Panel_Browser**: Panel de visualización donde se renderizan las cajas que representan el HTML del desarrollador.
- **Relay_Server**: Servidor intermediario que actúa como conducto ciego de datos entre el IDE y el Panel_Browser, sin lógica de validación.
- **Parser_HTML**: Módulo que analiza el código HTML del desarrollador y extrae las etiquetas para generar Objetos_Html.
- **Parser_CSS**: Módulo que analiza el código CSS del desarrollador y extrae directrices válidas.
- **Motor_Layout**: Módulo que calcula la posición y dimensiones de cada Objeto_Html en el Panel_Browser según las directrices y las reglas de estructuración predilecta.
- **Estructuración_Predilecta**: Posicionamiento semántico por defecto asignado a ciertas etiquetas HTML antes de que el desarrollador aplique estilos.

## Requirements

### Requirement 1: Parsing de HTML

**User Story:** Como desarrollador, quiero que Real Time interprete las etiquetas HTML que escribo en el IDE, para que se generen Objetos_Html correspondientes en el Panel_Browser.

#### Acceptance Criteria

1. WHEN el desarrollador escribe una etiqueta HTML válida en el IDE, THE Parser_HTML SHALL generar un Objeto_Html con forma de caja en el Panel_Browser.
2. WHEN el desarrollador escribe etiquetas HTML anidadas, THE Parser_HTML SHALL generar Objetos_Html anidados representados como cajas dentro de cajas.
3. WHEN el desarrollador elimina una etiqueta HTML del IDE, THE Parser_HTML SHALL eliminar el Objeto_Html correspondiente del Panel_Browser.
4. IF el desarrollador escribe HTML con sintaxis incompleta o inválida, THEN THE Parser_HTML SHALL ignorar la porción inválida y mantener el último estado estable de la representación.
5. THE Parser_HTML SHALL formatear Objetos_Html de vuelta a HTML válido (pretty printer).
6. FOR ALL Objetos_Html válidos, parsear luego imprimir luego parsear SHALL producir un objeto equivalente (propiedad round-trip).

### Requirement 2: Estructuración Predilecta

**User Story:** Como desarrollador, quiero que las etiquetas semánticas tengan una posición predeterminada en el Panel_Browser, para que tenga un esqueleto visual lógico desde el primer momento sin necesidad de aplicar estilos.

#### Acceptance Criteria

1. WHEN el Parser_HTML genera un Objeto_Html de tipo `header`, THE Motor_Layout SHALL posicionarlo en la parte superior del Panel_Browser.
2. WHEN el Parser_HTML genera un Objeto_Html de tipo `nav`, THE Motor_Layout SHALL posicionarlo en la parte superior del Panel_Browser, debajo del `header` si existe.
3. WHEN el Parser_HTML genera un Objeto_Html de tipo `footer`, THE Motor_Layout SHALL posicionarlo en la parte inferior del Panel_Browser.
4. WHEN el Parser_HTML genera un Objeto_Html de tipo `section`, THE Motor_Layout SHALL posicionarlo en la zona central del Panel_Browser.
5. WHEN el Parser_HTML genera un Objeto_Html de tipo `div`, THE Motor_Layout SHALL posicionarlo en la zona central del Panel_Browser.
6. WHEN el Parser_HTML genera un Objeto_Html con rol de background (incluyendo imágenes usadas como banner o background), THE Motor_Layout SHALL dimensionarlo al total de la página y posicionarlo detrás de todos los demás Objetos_Html.

### Requirement 3: Inyección de Estilos CSS

**User Story:** Como desarrollador, quiero que los estilos CSS que escribo se apliquen como directrices sobre los Objetos_Html en tiempo real, para que pueda ver cómo cambia la representación visual mientras escribo.

#### Acceptance Criteria

1. WHEN el desarrollador escribe una propiedad CSS con sintaxis válida, THE Parser_CSS SHALL generar una Directriz y aplicarla al Objeto_Html correspondiente en el Panel_Browser.
2. IF el desarrollador escribe una propiedad CSS con sintaxis incompleta o inválida, THEN THE Parser_CSS SHALL ignorar la entrada y mantener el Objeto_Html en su estado actual sin modificación.
3. WHEN una Directriz se aplica a un Objeto_Html, THE Panel_Browser SHALL reflejar la modificación visual de forma inmediata sin requerir recarga de página.
4. THE Parser_CSS SHALL formatear Directrices de vuelta a CSS válido (pretty printer).
5. FOR ALL Directrices válidas, parsear luego imprimir luego parsear SHALL producir una Directriz equivalente (propiedad round-trip).

### Requirement 4: Re-Inyección y Stateless

**User Story:** Como desarrollador, quiero que la representación visual sea stateless y se reconstruya completamente desde las directrices del código fuente, para que pueda iterar y experimentar libremente sin corromper el entorno visual.

#### Acceptance Criteria

1. WHEN el desarrollador modifica el valor de una propiedad CSS en el IDE, THE Real_Time_Platform SHALL re-inyectar la Directriz actualizada y modificar el Objeto_Html correspondiente.
2. WHEN el desarrollador elimina una propiedad CSS del IDE, THE Real_Time_Platform SHALL remover la Directriz correspondiente y revertir el Objeto_Html a su estado sin esa directriz.
3. THE Panel_Browser SHALL mantener una representación stateless donde la visualización se derive exclusivamente de las directrices actuales del código fuente, sin persistir estado visual propio.
4. WHEN el código fuente cambia, THE Real_Time_Platform SHALL reconstruir la representación visual completa desde las directrices actuales, sin depender de estado previo.

### Requirement 5: Comunicación IDE-Browser vía Relay

**User Story:** Como desarrollador, quiero que los cambios en mi IDE se transmitan al Panel_Browser con latencia mínima, para que la representación visual se actualice a la velocidad a la que escribo.

#### Acceptance Criteria

1. WHEN el desarrollador realiza un cambio en el código fuente, THE Relay_Server SHALL transmitir los datos al Panel_Browser sin deserializar, validar ni transformar el contenido.
2. THE Relay_Server SHALL operar como conducto unidireccional (push-only) desde el IDE hacia el Panel_Browser, sin flujo de retorno request-response.
3. THE Real_Time_Platform SHALL activar el Relay_Server bajo demanda mediante un atajo de teclado, con la API cargada en memoria (hot-loaded) y lista para procesar.
4. IF el Relay_Server pierde la conexión con el Panel_Browser, THEN THE Real_Time_Platform SHALL intentar reconexión automática y re-inyectar el estado completo de directrices al reconectar.

### Requirement 6: Renderizado de Cajas en el Panel Browser

**User Story:** Como desarrollador, quiero ver cada etiqueta HTML representada como una caja geométrica en el Panel_Browser, para que tenga una referencia visual clara de la estructura de mi página.

#### Acceptance Criteria

1. THE Panel_Browser SHALL representar cada Objeto_Html como una caja geométrica con bordes visibles y etiqueta identificadora.
2. WHEN un Objeto_Html contiene Objetos_Html hijos, THE Panel_Browser SHALL renderizar las cajas hijas dentro de la caja padre, reflejando la jerarquía de anidación.
3. WHEN una Directriz modifica dimensiones, posición o apariencia de un Objeto_Html, THE Panel_Browser SHALL actualizar la caja correspondiente de forma inmediata.
4. WHILE el desarrollador no haya aplicado estilos a un Objeto_Html, THE Motor_Layout SHALL aplicar las reglas de Estructuración_Predilecta para posicionar la caja.
