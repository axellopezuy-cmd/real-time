# Real Time — Especificación Técnica Fundacional

## 1. ¿Qué es Real Time?

Real Time es una plataforma que genera una **representación ficticia fidedigna** del código front-end que el desarrollador escribe en su IDE. Está pensada exclusivamente para la fase de **estructuración y maquetación** del desarrollo web.

El desarrollador escribe código en el IDE y en el panel del browser se genera una representación visual en tiempo real, sin necesidad de refrescar la página.

---

## 2. Modelo de Representación: Cajas

Todo objeto HTML es una **caja**.

- Cualquier etiqueta HTML se representa como una caja geométrica.
- Si hay anidación, se representan como **cajas dentro de cajas**.
- Las cajas sufren adaptaciones progresivas a medida que el desarrollador aplica estilos.

---

## 3. Estructuración Predilecta

Ciertas etiquetas tienen una posición predeterminada antes de que el dev aplique estilos:

| Etiqueta     | Posición predilecta                                      |
|--------------|----------------------------------------------------------|
| `header`     | Cabeza de la página                                      |
| `nav`        | Cabeza de la página (junto al header)                    |
| `footer`     | Pie de la página                                         |
| `section`    | Centro de la página                                      |
| `div`        | Centro (sin ubicación semántica pensada)                 |
| `background` | Ocupa el total de la página, se ubica detrás de todos los objetos |
| Imágenes como banner/background | Se comportan igual que background |

Esta posición se mantiene hasta que el dev decida implementar estilos propios.

---

## 4. Flujo de Trabajo Principal

```
INICIO
  si dev inserta etiqueta HTML →
    se genera Objeto_Html en browser con forma de caja
  si dev aplica estilo a Objeto_Html →
    si sintaxis de estilo correcta →
      se modifica la caja
    sino →
      no se modifica (se ignora)
FIN
```

---

## 5. Inyección de Estilos CSS

```
INICIO
  si dev escribe CSS →
    Inyección_EstilosCss
    cambia propiedad de Objeto_Html
    trigger(estilo CSS)
    si trigger → inyección
    si inyección → modificación de caja HTML
FIN
```

---

## 6. Re-Inyección y Directrices

Los estilos CSS se tratan como **directrices**. Las directrices son la fuente de verdad única para la representación visual.

- Si cambia el valor de una propiedad → cambia la fuente de verdad → se re-inyectan los estilos.
- Las directrices **no son código**. Son instrucciones derivadas del código que solo sirven para modificar la representación visual.
- Las directrices **no pueden suplantar al código fuente**.

```
RE_INYECCIÓN
INICIO
  directriz → Modificación_ObjetoHtml(stateless)
  si Nueva_Directriz →
    Re_Inyección → Modificación_ObjetoHtml(stateless)
FIN
```

---

## 7. Stateless: La Necesidad Fundamental

La representación visual es **stateless** (sin estado persistente).

### ¿Por qué stateless?

- El propósito de Real Time es dar una **referencia visual** durante el desarrollo front.
- La necesidad surge de la **iteración sobre ideas y modificación rápida**.
- Las directrices son los estilos aplicados del código, **no son el código en sí mismo**.
- No hay necesidad real de persistencia porque las directrices no son código.
- Las directrices no pueden ser fuente de verdad ni suplantar al código.
- Solo sirven para modificar la representación visual.
- La representación visual no persiste código. No se reescribe sobre código persistido.

### Consecuencia

El **stateless** y la **re-inyección** son el punto de partida para toda edición y modificación durante el desarrollo. Esto permite experimentación destructiva sin corromper el entorno.

---

## 8. Representación Visual

```
REPRESENTACIÓN_VISUAL
INICIO
  a → Etiqueta_Html(Objeto_Html)
  si Objeto_Html →
    Representación_Visual
FIN
```

Toda etiqueta HTML se convierte en un Objeto_Html. Todo Objeto_Html genera una representación visual (caja). Las directrices predilectas se aplican a ciertas etiquetas para darle sentido inicial al desarrollo de la página web.

---

## 9. Decisiones Arquitectónicas

### A. Motor de Layout Heurístico
Pre-posicionar semánticamente los elementos reduce la carga cognitiva y permite renderizado inicial de latencia casi cero.

### B. Arquitectura Stateless
Elimina conflictos de herencia fantasma, errores de sincronización y fugas de memoria.

### C. Tolerancia a Errores (Diseño Defensivo)
Código incompleto se ignora. La previsualización se mantiene en el último estado estable.

### D. Separación Relay (Servidor) / API (Control)
El servidor es un conducto ciego (plano de datos). La inteligencia vive en los extremos (plano de control). Los paquetes viajan a velocidad cruda del protocolo de red.

### E. API Push-Only, Hot-Loaded
Sin cold start. Sin request-response. Modelo de empuje unidireccional. Procesamiento zero-copy.

### F. Núcleo en Rust
Sin garbage collector. Concurrencia segura. Sin pausas impredecibles. Sin stuttering visual.

### G. MVP Individual
Flujo de datos 1:1. Sin resolución de conflictos multiusuario. Latencia mínima absoluta.
