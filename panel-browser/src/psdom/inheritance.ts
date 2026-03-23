/**
 * @module inheritance
 *
 * Resolución de herencia CSS mediante tree walk sobre el árbol de ObjetoHtml.
 *
 * Implementa la propagación de propiedades heredables de CSS: cuando un nodo
 * no tiene un valor explícito para una propiedad heredable, se busca en la
 * cadena de ancestros hasta encontrar un valor, o se usa el default de CSS.
 *
 * Este módulo NO depende del DOM. Opera sobre el mapa de directrices resueltas
 * y la cadena de ancestros como array de IDs.
 *
 * ## Prioridad de resolución
 *
 * 1. Valor explícito en el nodo (directriz resuelta por especificidad)
 * 2. Valor del ancestro más cercano que tenga la propiedad
 * 3. Valor por defecto de CSS
 *
 * ## Limitaciones del MVP
 *
 * - **`inherit` / `initial` / `unset` / `revert`**: Los keywords de herencia
 *   CSS no se interpretan. Si una directriz tiene `color: inherit`, se trata
 *   como valor explícito literal "inherit", no se resuelve al valor del padre.
 *
 * - **Propiedades heredables incompletas**: Solo se cubren 11 propiedades
 *   comunes. CSS tiene ~90 propiedades heredables. Propiedades como
 *   `list-style-type`, `border-collapse`, `quotes`, `white-space` no están
 *   incluidas. Se pueden agregar al set sin cambiar la lógica.
 *
 * - **Shorthand expansion**: Si el parser envía `font` como shorthand en vez
 *   de `font-family`, `font-size`, etc. por separado, la herencia no lo
 *   descompone. Se asume que las directrices llegan como propiedades individuales.
 *
 * - **Valores relativos**: `font-size: 1.5em` o `font-size: 120%` se heredan
 *   como string literal sin calcular el valor computado. El rendering final
 *   puede diferir del browser real para valores relativos heredados.
 *
 * @example
 * ```ts
 * // Nodo hijo sin color explícito hereda del padre
 * const dirs = resolveInheritance('child-1', resolvedMap, ['parent-1']);
 * // Si parent-1 tiene color: red, child-1 recibe { selector: 'inherited', property: 'color', value: 'red' }
 * ```
 */
import type { Directriz } from '../types';

/**
 * Set de propiedades CSS que se heredan de padre a hijo.
 *
 * Referencia: https://www.w3.org/TR/CSS22/propidx.html (columna "Inherited?")
 *
 * Este set es extensible: agregar una propiedad aquí (y su default en
 * `CSS_DEFAULTS`) es suficiente para que el InheritanceResolver la propague.
 */
export const INHERITABLE_PROPERTIES = new Set([
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'text-align',
  'visibility',
  'cursor',
  'letter-spacing',
  'word-spacing',
]);

/**
 * Valores por defecto de CSS para propiedades heredables.
 *
 * Cuando ningún ancestro tiene un valor para una propiedad heredable,
 * se usa el valor de esta tabla como fallback. Los valores corresponden
 * a los initial values de la spec CSS 2.2.
 *
 * Cada propiedad en `INHERITABLE_PROPERTIES` debe tener una entrada aquí.
 */
export const CSS_DEFAULTS: Record<string, string> = {
  'color': 'black',
  'font-family': 'serif',
  'font-size': '16px',
  'font-weight': 'normal',
  'font-style': 'normal',
  'line-height': 'normal',
  'text-align': 'start',
  'visibility': 'visible',
  'cursor': 'auto',
  'letter-spacing': 'normal',
  'word-spacing': 'normal',
};

/**
 * Retorna `true` si la propiedad es heredable en CSS.
 *
 * @param property - Nombre de la propiedad CSS (e.g. `'color'`, `'margin'`)
 * @returns `true` si está en el set de propiedades heredables
 *
 * @example
 * ```ts
 * isInheritable('color')   // → true
 * isInheritable('margin')  // → false
 * ```
 */
export function isInheritable(property: string): boolean {
  return INHERITABLE_PROPERTIES.has(property);
}

/**
 * Resuelve herencia para un nodo dado su mapa de directrices resueltas
 * y la cadena de ancestros (del más cercano al más lejano).
 *
 * Para cada propiedad heredable que el nodo no tiene explícitamente,
 * busca en la cadena de ancestros y aplica el primer valor encontrado.
 * Si ningún ancestro tiene la propiedad, usa el default de CSS.
 *
 * Las directrices heredadas se agregan con `selector: 'inherited'` y
 * las de default con `selector: 'default'` para distinguirlas de las
 * directrices explícitas en diagnóstico.
 *
 * @param nodeId - ID del ObjetoHtml a resolver
 * @param resolvedMap - Mapa de ID → directrices resueltas por especificidad (sin herencia)
 * @param ancestorChain - IDs de ancestros ordenados del más cercano al más lejano
 * @returns Lista de directrices del nodo: explícitas + heredadas + defaults
 *
 * @example
 * ```ts
 * // Árbol: <div id="parent" style="color:red"> <p id="child"> </p> </div>
 * const result = resolveInheritance('child', resolvedMap, ['parent']);
 * // result incluye { selector: 'inherited', property: 'color', value: 'red' }
 * ```
 */
export function resolveInheritance(
  nodeId: string,
  resolvedMap: Map<string, Directriz[]>,
  ancestorChain: string[],
): Directriz[] {
  const nodeDirectives = resolvedMap.get(nodeId) || [];
  const explicitProps = new Set(nodeDirectives.map(d => d.property));
  const inherited: Directriz[] = [];

  for (const prop of INHERITABLE_PROPERTIES) {
    if (explicitProps.has(prop)) continue;

    let found = false;
    for (const ancestorId of ancestorChain) {
      const ancestorDirs = resolvedMap.get(ancestorId) || [];
      const match = ancestorDirs.find(d => d.property === prop);
      if (match) {
        inherited.push({ selector: 'inherited', property: prop, value: match.value });
        found = true;
        break;
      }
    }

    if (!found && CSS_DEFAULTS[prop]) {
      inherited.push({ selector: 'default', property: prop, value: CSS_DEFAULTS[prop] });
    }
  }

  return [...nodeDirectives, ...inherited];
}
