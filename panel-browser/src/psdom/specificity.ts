/**
 * @module specificity
 *
 * Cálculo de especificidad CSS como función matemática pura.
 *
 * Implementa el algoritmo de especificidad de la spec CSS Selectors Level 4
 * (https://www.w3.org/TR/selectors-4/#specificity-rules) representando
 * la especificidad como tupla (a, b, c).
 *
 * Este módulo NO depende del DOM. Opera exclusivamente sobre strings de
 * selectores CSS y es testeable en cualquier entorno.
 *
 * ## Limitaciones del MVP
 *
 * - **`!important`**: No se maneja. Una declaración con `!important` se trata
 *   como declaración normal. Para soportarlo, `resolveBySpecificity` necesitaría
 *   un paso previo que separe declaraciones `!important` de las normales y les
 *   dé prioridad absoluta.
 *
 * - **Selectores compuestos con `:is()`, `:has()`, `:where()`**: No se parsean.
 *   `:is()` y `:has()` deberían tomar la especificidad del argumento más
 *   específico; `:where()` siempre es (0,0,0). Actualmente se cuentan como
 *   una pseudoclase genérica (0,1,0).
 *
 * - **Selectores anidados (CSS Nesting)**: No se soportan. El parser asume
 *   selectores planos sin `&`.
 *
 * - **`@layer`**: Las capas de cascada no se consideran. Todas las directrices
 *   se tratan como pertenecientes a la misma capa.
 *
 * @example
 * ```ts
 * calculateSpecificity('#main .active')  // → [1, 1, 0]
 * calculateSpecificity('div > p:first-child')  // → [0, 1, 2]
 * calculateSpecificity(':not(.hidden)')  // → [0, 1, 0]
 * ```
 */
import type { Directriz } from '../types';

/**
 * Especificidad CSS como tupla `[a, b, c]`.
 *
 * - `a` — número de selectores de ID (`#foo`)
 * - `b` — número de selectores de clase (`.foo`), atributo (`[href]`), pseudoclase (`:hover`)
 * - `c` — número de selectores de elemento (`div`) y pseudoelemento (`::before`)
 *
 * La comparación es lexicográfica: se compara `a` primero, luego `b`, luego `c`.
 *
 * @example
 * ```ts
 * const s: Specificity = [1, 2, 0]; // #id.class1.class2
 * ```
 */
export type Specificity = [number, number, number];

/**
 * Calcula la especificidad de un selector CSS.
 *
 * Función pura: mismo input → mismo output, sin dependencia de DOM ni estado externo.
 *
 * El algoritmo procesa el selector en este orden:
 * 1. Extrae y recursa sobre el contenido de `:not()` (el `:not` mismo no cuenta)
 * 2. Cuenta pseudoelementos (`::before`, `::after`) → incrementa `c`
 * 3. Cuenta IDs (`#foo`) → incrementa `a`
 * 4. Cuenta atributos (`[href]`), pseudoclases (`:hover`), clases (`.foo`) → incrementa `b`
 * 5. Cuenta elementos (`div`, `p`) → incrementa `c`
 *
 * El selector universal (`*`) y los combinadores (`>`, `+`, `~`, ` `) no contribuyen
 * a la especificidad.
 *
 * @param selector - Selector CSS a analizar
 * @returns Tupla `[a, b, c]` con la especificidad calculada
 *
 * @example
 * ```ts
 * calculateSpecificity('div')           // → [0, 0, 1]
 * calculateSpecificity('.active')       // → [0, 1, 0]
 * calculateSpecificity('#main')         // → [1, 0, 0]
 * calculateSpecificity('#main .active') // → [1, 1, 0]
 * calculateSpecificity(':not(.hidden)') // → [0, 1, 0]
 * ```
 */
export function calculateSpecificity(selector: string): Specificity {
  let a = 0, b = 0, c = 0;

  // Procesar :not() recursivamente — el :not mismo no cuenta, pero su contenido sí
  let processed = selector.replace(/:not\(([^)]+)\)/g, (_, inner: string) => {
    const [ia, ib, ic] = calculateSpecificity(inner.trim());
    a += ia;
    b += ib;
    c += ic;
    return '';
  });

  // Remover pseudoelementos (::before, ::after, etc.) — cuentan como c
  const pseudoElements = processed.match(/::[a-zA-Z][\w-]*/g) || [];
  c += pseudoElements.length;
  processed = processed.replace(/::[a-zA-Z][\w-]*/g, '');

  // Contar IDs: #identifier
  const ids = processed.match(/#[a-zA-Z_][\w-]*/g) || [];
  a += ids.length;
  processed = processed.replace(/#[a-zA-Z_][\w-]*/g, '');

  // Contar selectores de atributo: [attr], [attr=val], etc.
  const attrs = processed.match(/\[[^\]]+\]/g) || [];
  b += attrs.length;
  processed = processed.replace(/\[[^\]]+\]/g, '');

  // Contar pseudoclases: :hover, :nth-child(2n+1), etc.
  const pseudoClasses = processed.match(/:[a-zA-Z][\w-]*(\([^)]*\))?/g) || [];
  b += pseudoClasses.length;
  processed = processed.replace(/:[a-zA-Z][\w-]*(\([^)]*\))?/g, '');

  // Contar clases: .classname
  const classes = processed.match(/\.[a-zA-Z_][\w-]*/g) || [];
  b += classes.length;
  processed = processed.replace(/\.[a-zA-Z_][\w-]*/g, '');

  // Contar elementos: tokens que son nombres de tag válidos
  // Remover combinadores y universal selector
  const cleaned = processed.replace(/[>+~*]/g, ' ').trim();
  if (cleaned) {
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (/^[a-zA-Z][\w-]*$/.test(token)) {
        c++;
      }
    }
  }

  return [a, b, c];
}

/**
 * Compara dos especificidades lexicográficamente.
 *
 * @param a - Primera especificidad
 * @param b - Segunda especificidad
 * @returns Número positivo si `a` gana, negativo si `b` gana, `0` si empatan
 *
 * @example
 * ```ts
 * compareSpecificity([1, 0, 0], [0, 10, 0]) // → 1 (un ID siempre gana a clases)
 * compareSpecificity([0, 1, 0], [0, 1, 0])  // → 0 (empate)
 * ```
 */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

/**
 * Dada una lista de directrices para el mismo nodo y la misma propiedad CSS,
 * retorna la directriz ganadora según las reglas de cascada.
 *
 * Reglas de resolución:
 * 1. Mayor especificidad gana
 * 2. En empate de especificidad, la última en orden de declaración gana
 *
 * El "orden de declaración" está determinado por el orden del array de entrada,
 * que a su vez depende del orden de fusión del Consolidator en Rust (alfabético
 * por path de archivo). Esta dependencia es intencional y documentada.
 *
 * **Limitación MVP**: No soporta `!important`. Una declaración `!important`
 * se trata como declaración normal y compite solo por especificidad/orden.
 *
 * @param directives - Lista no vacía de directrices candidatas (mismo nodo, misma propiedad)
 * @returns La directriz ganadora
 * @throws {Error} Si la lista está vacía
 *
 * @example
 * ```ts
 * const winner = resolveBySpecificity([
 *   { selector: 'div', property: 'color', value: 'red' },
 *   { selector: '.active', property: 'color', value: 'blue' },
 * ]);
 * // winner.value === 'blue' (.active tiene mayor especificidad)
 * ```
 */
export function resolveBySpecificity(directives: Directriz[]): Directriz {
  if (directives.length === 0) {
    throw new Error('resolveBySpecificity requires at least one directive');
  }
  return directives.reduce((winner, current) => {
    const cmp = compareSpecificity(
      calculateSpecificity(current.selector),
      calculateSpecificity(winner.selector)
    );
    // Mayor especificidad gana; empate → última declaración (current viene después)
    return cmp >= 0 ? current : winner;
  });
}
