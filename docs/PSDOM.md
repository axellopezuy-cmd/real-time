# PSDOM — Proxy Shadow DOM

## Qué es

PSDOM es el módulo del Panel Browser que resuelve la aplicación completa de directrices CSS sobre el árbol de ObjetoHtml. Delega selector matching al motor nativo del browser (via `querySelectorAll` en un iframe aislado), calcula especificidad como función matemática pura, y propaga herencia recorriendo el árbol de ancestros.

Reemplaza el `matchDirectives` simple del LayoutEngine que solo soportaba selectores tag, `.class` y `#id`.

## Qué no es

- No es una implementación de Web Components ni de Shadow DOM real
- No renderiza nada — solo resuelve "qué directriz aplica a qué nodo"
- No reemplaza al LayoutEngine — el LayoutEngine sigue calculando posiciones y zonas
- No es un motor CSS completo — no evalúa valores, no ejecuta animaciones

## Arquitectura

```
RenderMessage → PSDOM.resolve() → Map<id, Directriz[]> → LayoutEngine → DirectiveApplicator → BoxRenderer
```

Tres piezas ortogonales:

| Pieza                 | Archivo                  | Responsabilidad                          | DOM |
|-----------------------|--------------------------|------------------------------------------|-----|
| SelectorResolver      | `selector-resolver.ts`   | `querySelectorAll` nativo via iframe     | Sí  |
| SpecificityCalculator | `specificity.ts`         | Tupla `(a, b, c)` por parsing de regex   | No  |
| InheritanceResolver   | `inheritance.ts`         | Tree walk sobre cadena de ancestros      | No  |
| PSDOM (orquestador)   | `psdom.ts`               | Coordina las tres piezas                 | No  |

## Ciclo de vida

1. **Instanciación**: Se crea una vez cuando el Panel Browser arranca. El constructor crea el iframe invisible.
2. **Resolución**: En cada RenderMessage se llama `resolve(objects, directives)`. Cada llamada es stateless.
3. **Destrucción**: En shutdown del panel se llama `destroy()`, que remueve el iframe del DOM.

El iframe persiste como contenedor entre ciclos (evita costo de creación/destrucción), pero su contenido se limpia en cada `resolve()`.

## Dependencia de orden con el Consolidator

El orden de las directrices en el array de entrada determina quién gana en empate de especificidad (última declaración gana). Ese orden lo fija el `MessageConsolidator` en Rust, que fusiona archivos en orden alfabético por path. Si el Consolidator cambia su orden de fusión, el resultado de cascada cambia.

---

## Limitaciones del MVP

### Especificidad y Cascada

| Feature                | Estado    | Detalle |
|------------------------|-----------|---------|
| `!important`           | No soportado | Se trata como declaración normal. Para soportarlo: separar declaraciones `!important` de las normales en `resolveBySpecificity` y darles prioridad absoluta. Cambio estimado: ~15 líneas en `specificity.ts`. |
| `:is()`, `:has()`, `:where()` | Parcial | Se cuentan como pseudoclase genérica `(0,1,0)`. Correcto: `:is()` y `:has()` deberían tomar la especificidad del argumento más específico; `:where()` siempre es `(0,0,0)`. |
| `@layer` (cascade layers) | No soportado | Todas las directrices se tratan como misma capa. |
| CSS Nesting (`&`)      | No soportado | El parser asume selectores planos. |

### Herencia

| Feature                | Estado    | Detalle |
|------------------------|-----------|---------|
| `inherit` / `initial` / `unset` / `revert` | No interpretado | Se tratan como valores literales. `color: inherit` no se resuelve al valor del padre. |
| Propiedades heredables | Parcial (11 de ~90) | Cubiertas: `color`, `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `text-align`, `visibility`, `cursor`, `letter-spacing`, `word-spacing`. Faltan: `list-style-type`, `border-collapse`, `quotes`, `white-space`, etc. Extensible: agregar al set + default. |
| Shorthand expansion    | No soportado | Si el parser envía `font` en vez de `font-family`/`font-size` por separado, la herencia no lo descompone. Se asume que las directrices llegan como propiedades individuales. |
| Valores relativos heredados | Literal | `font-size: 1.5em` o `120%` se heredan como string sin calcular el valor computado. |

### Selector Matching

| Feature                | Estado    | Detalle |
|------------------------|-----------|---------|
| Pseudoclases dinámicas (`:hover`, `:focus`, `:active`) | Sin efecto | Sintácticamente válidas, `querySelectorAll` las acepta, pero nunca matchean porque no hay interacción de usuario en el iframe. `a:hover` retorna lista vacía. |
| Media queries          | No soportado | El iframe tiene dimensiones 0×0. Para soportar: sincronizar dimensiones del iframe con el viewport del panel. |
| `[attr="val" i]` (case-insensitive) | No testeado | Depende del soporte del browser/happy-dom. Debería funcionar. |
| Shadow DOM real        | No implementado | No se usa `attachShadow`. No hay shadow boundaries. |

### Valores CSS

| Feature                | Estado    | Detalle |
|------------------------|-----------|---------|
| `calc()`, `min()`, `max()`, `clamp()` | No evaluado | Se pasan como strings literales. Feature de evaluación de valores, no de selector matching. |
| `@keyframes`           | No procesado | Feature de rendering, no de selector matching. |
| `@font-face`           | No procesado | Feature de rendering, no de selector matching. |

### Detección de conflictos

| Feature                | Estado    | Detalle |
|------------------------|-----------|---------|
| Tracking de `source_file` | No disponible | La detección agrupa por selector distinto, no por archivo origen. Para reportar "archivo A vs archivo B" se necesita que `Directriz` lleve un campo `source_file` desde el crate Rust. |

### Rendimiento

| Feature                | Estado    | Detalle |
|------------------------|-----------|---------|
| Cache de especificidad | No implementado | Si el mismo selector aparece N veces, se calcula N veces. Trivial de agregar con un `Map<string, Specificity>`. |
| Diffing incremental    | No implementado | Cada `resolve()` reconstruye todo. Para árboles típicos de maquetación (decenas de nodos) es despreciable. |

---

## Gap de mediano plazo

### Variables CSS `var(--x)`

Las custom properties no son un detalle avanzado: son parte del flujo de trabajo diario de cualquier dev moderno. Frameworks, design systems y cualquier proyecto con theming las usa como base. Este límite va a sentirse antes de lo esperado.

Hoy, si una directriz tiene `color: var(--primary)`, PSDOM la trata como valor literal `"var(--primary)"` sin resolver.

Resolver `var(--x)` requiere:

1. Que el parser Rust extraiga declaraciones de custom properties (`--primary: #333`) como directrices especiales
2. Que PSDOM mantenga un mapa de custom properties resueltas por nodo (respetando cascada y herencia — las custom properties son heredables por spec)
3. Que al encontrar `var(--x)` en un valor, se sustituya por el valor resuelto, con fallback al segundo argumento de `var()` si existe

No es trivial pero tampoco es un rediseño. El InheritanceResolver ya tiene la mecánica de propagación por ancestros que las custom properties necesitan. El costo principal es el parsing de `var()` y la resolución recursiva (una variable puede referenciar otra).

---

## Lo que el proxy no resuelve (límites permanentes)

Estas son limitaciones de diseño, no del MVP. No se planea resolverlas porque están fuera del alcance conceptual de PSDOM. Son consecuencias directas de lo que Real Time dice ser: una herramienta de estructuración y maquetación, no un browser. Son features del diseño, no deuda técnica.

1. **No calcula layout** — Posiciones, dimensiones y zonas predilectas son responsabilidad del LayoutEngine. PSDOM solo resuelve "qué directriz aplica a qué nodo".

2. **No ejecuta JavaScript** — Selectores que dependen de estado JS (clases agregadas dinámicamente, estilos inline via JS) están fuera de alcance. Real Time solo ve HTML y CSS estáticos del código fuente.

3. **No valida valores CSS** — PSDOM resuelve qué directriz gana, no si `color: banana` es un valor válido. Eso es responsabilidad del parser Rust o del DirectiveApplicator.

4. **No persiste estado entre ciclos** — Por principio fundacional del sistema. Cada RenderMessage produce una representación completa desde cero.

5. **No soporta estilos inline** — Los atributos `style=""` del HTML no se procesan como directrices. El parser Rust los ignora (las directrices vienen exclusivamente de archivos CSS).

6. **No implementa el box model** — `margin`, `padding`, `border` como propiedades de layout son responsabilidad del LayoutEngine/DirectiveApplicator, no de PSDOM.

7. **No resuelve `@import`** — La resolución de imports entre archivos CSS es responsabilidad del Scanner/FileWatcher en Rust, no del panel browser.

---

## Archivos del módulo

```
panel-browser/src/psdom/
├── index.ts              # Barrel exports
├── psdom.ts              # Orquestador PSDOM
├── selector-resolver.ts  # SelectorResolver (iframe)
├── specificity.ts        # SpecificityCalculator (puro)
└── inheritance.ts        # InheritanceResolver (tree walk)
```

## Tests

```
panel-browser/src/__tests__/
├── specificity.test.ts       # Property 4 & 5 (13 tests)
├── inheritance.test.ts       # Property 6 (5 tests)
├── selector-resolver.test.ts # Property 1 & 7 (11 tests)
├── psdom.test.ts             # Property 3 & 8 (3 tests)
└── psdom-compat.test.ts      # Property 9 (3 tests)
```

Total: 35 tests, 9 propiedades de correctitud verificadas con `fast-check`.
