# Requirements Document

## Introduction

Evolución de Real Time para eliminar toda fricción de setup. El desarrollador descarga un binario único, ejecuta un shortcut, y el sistema completo arranca automáticamente: relay, file watcher, y panel browser. El dev empieza a escribir código y ve la representación visual en tiempo real sin ningún paso manual adicional.

## Glossary

- **Real_Time_CLI**: Binario único ejecutable que contiene el relay server, el file watcher, el parser y el servidor web del panel browser.
- **File_Watcher**: Módulo que observa cambios en archivos `.html` y `.css` del directorio de trabajo del desarrollador y dispara re-parsing automático.
- **Panel_Server**: Servidor HTTP embebido que sirve el Panel_Browser como página web estática en un puerto local.
- **Launcher**: Módulo que orquesta el arranque de todos los componentes y abre el browser automáticamente.
- **Project_Scanner**: Módulo que detecta archivos HTML y CSS en el directorio de trabajo del desarrollador.

## Requirements

### Requirement 1: Binario Único Ejecutable

**User Story:** Como desarrollador, quiero descargar un solo archivo ejecutable para mi sistema operativo, para que pueda usar Real Time sin instalar dependencias ni compilar nada.

#### Acceptance Criteria

1. THE Real_Time_CLI SHALL distribuirse como un binario único pre-compilado para Linux, macOS y Windows.
2. THE Real_Time_CLI SHALL funcionar sin requerir instalación de dependencias externas (Rust, Node.js, npm).
3. THE Real_Time_CLI SHALL incluir el relay server, file watcher, parser, panel browser y servidor HTTP embebido en un solo ejecutable.
4. WHEN el desarrollador ejecuta el binario sin argumentos, THE Real_Time_CLI SHALL usar el directorio actual como directorio de trabajo.
5. WHEN el desarrollador ejecuta el binario con un argumento de ruta, THE Real_Time_CLI SHALL usar esa ruta como directorio de trabajo.

### Requirement 2: Arranque con Un Solo Comando

**User Story:** Como desarrollador, quiero ejecutar un solo comando o shortcut y que todo el sistema arranque automáticamente, para que pueda empezar a trabajar de inmediato.

#### Acceptance Criteria

1. WHEN el desarrollador ejecuta `realtime`, THE Launcher SHALL iniciar el relay server, el file watcher, el panel server y abrir el browser automáticamente.
2. WHEN el Launcher arranca, THE Launcher SHALL completar el arranque de todos los componentes en menos de 2 segundos.
3. WHEN el Launcher arranca, THE Launcher SHALL mostrar en la terminal un mensaje indicando la URL del panel browser y el directorio observado.
4. WHEN el Launcher detecta que el puerto del relay o del panel server está ocupado, THE Launcher SHALL seleccionar un puerto alternativo disponible automáticamente.
5. WHEN el desarrollador presiona Ctrl+C, THE Launcher SHALL detener todos los componentes de forma limpia.

### Requirement 3: File Watcher Automático

**User Story:** Como desarrollador, quiero que Real Time detecte automáticamente los archivos HTML y CSS de mi proyecto y observe sus cambios, para que no tenga que configurar nada manualmente.

#### Acceptance Criteria

1. WHEN el Launcher arranca, THE Project_Scanner SHALL buscar recursivamente archivos `.html` y `.css` en el directorio de trabajo.
2. WHEN el File_Watcher detecta que un archivo `.html` o `.css` ha sido guardado, THE File_Watcher SHALL disparar un re-parsing del archivo modificado y enviar el RenderMessage actualizado al relay.
3. WHEN el File_Watcher detecta un nuevo archivo `.html` o `.css` creado en el directorio, THE File_Watcher SHALL incluirlo automáticamente en la observación.
4. WHEN el File_Watcher detecta que un archivo `.html` o `.css` ha sido eliminado, THE File_Watcher SHALL remover los Objetos_Html correspondientes del RenderMessage.
5. THE File_Watcher SHALL ignorar directorios comunes no relevantes: `node_modules`, `.git`, `target`, `dist`, `build`.
6. WHEN múltiples archivos cambian simultáneamente, THE File_Watcher SHALL agrupar los cambios (debounce) y enviar un solo RenderMessage consolidado.

### Requirement 4: Panel Browser Embebido

**User Story:** Como desarrollador, quiero que el panel browser se abra automáticamente en mi navegador al arrancar Real Time, para que no tenga que configurar ni abrir nada manualmente.

#### Acceptance Criteria

1. THE Panel_Server SHALL servir el Panel_Browser como página web estática en un puerto local.
2. WHEN el Launcher arranca, THE Launcher SHALL abrir automáticamente el navegador predeterminado del sistema con la URL del Panel_Browser.
3. WHEN el Panel_Browser se conecta al relay, THE Panel_Browser SHALL mostrar un indicador de estado "Connected" con el número de archivos observados.
4. IF el Panel_Browser pierde conexión con el relay, THEN THE Panel_Browser SHALL mostrar un indicador "Reconnecting..." y reconectar automáticamente.
5. WHEN el Panel_Browser reconecta, THE Panel_Server SHALL re-enviar el estado completo actual para restaurar la visualización.

### Requirement 5: Soporte Multi-Archivo

**User Story:** Como desarrollador, quiero que Real Time combine todos mis archivos HTML y CSS en una sola representación visual, para que pueda ver la estructura completa de mi proyecto.

#### Acceptance Criteria

1. WHEN el Project_Scanner encuentra múltiples archivos HTML, THE Parser SHALL combinar los Objetos_Html de todos los archivos en un solo árbol de representación.
2. WHEN el Project_Scanner encuentra múltiples archivos CSS, THE Parser SHALL combinar todas las Directrices de todos los archivos en una sola lista.
3. WHEN un archivo individual cambia, THE Parser SHALL re-parsear solo ese archivo y actualizar su contribución al RenderMessage sin re-parsear los demás.
4. THE Panel_Browser SHALL mostrar una indicación visual de qué archivo originó cada Objeto_Html.
