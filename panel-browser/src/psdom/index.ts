/**
 * @module psdom
 *
 * PSDOM (Proxy Shadow DOM) — Módulo de resolución completa de directrices CSS.
 *
 * Delega selector matching al motor nativo del browser, calcula especificidad
 * como función matemática pura, y resuelve herencia por tree walk. Reemplaza
 * el `matchDirectives` simple del LayoutEngine.
 *
 * ## Exports principales
 *
 * - {@link PSDOM} — Orquestador. Único punto de entrada para resolver directrices.
 * - {@link SelectorResolver} — Resolución de selectores via iframe aislado.
 * - {@link calculateSpecificity} — Cálculo de especificidad `(a, b, c)`.
 * - {@link resolveInheritance} — Propagación de propiedades heredables.
 *
 * ## Uso típico
 *
 * ```ts
 * import { PSDOM } from './psdom';
 *
 * const psdom = new PSDOM();
 *
 * // En cada RenderMessage:
 * const result = psdom.resolve(objects, directives);
 * // result.directives → Map<id, Directriz[]>
 *
 * // En shutdown:
 * psdom.destroy();
 * ```
 *
 * ## Arquitectura
 *
 * Tres piezas ortogonales, cada una testeable e intercambiable por separado:
 *
 * | Pieza                | Responsabilidad                    | Depende de DOM |
 * |----------------------|------------------------------------|----------------|
 * | SelectorResolver     | querySelectorAll nativo via iframe | Sí             |
 * | SpecificityCalculator| Tupla (a,b,c) por regex            | No             |
 * | InheritanceResolver  | Tree walk sobre ancestros          | No             |
 *
 * @packageDocumentation
 */

export { PSDOM } from './psdom';
export type { ResolvedDirectives, DirectiveConflict } from './psdom';

export { SelectorResolver } from './selector-resolver';
export type { SelectorResult } from './selector-resolver';

export { calculateSpecificity, compareSpecificity, resolveBySpecificity } from './specificity';
export type { Specificity } from './specificity';

export { isInheritable, resolveInheritance, INHERITABLE_PROPERTIES, CSS_DEFAULTS } from './inheritance';
