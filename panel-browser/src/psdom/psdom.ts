/**
 * @module psdom
 *
 * PSDOM (Proxy Shadow DOM) — Orquestador principal del módulo.
 *
 * Coordina las tres piezas ortogonales del sistema:
 * 1. **SelectorResolver** — delega `querySelectorAll` al browser via iframe
 * 2. **SpecificityCalculator** — resuelve cascada como función matemática pura
 * 3. **InheritanceResolver** — propaga propiedades heredables por tree walk
 *
 * ## Posición en el pipeline
 *
 * ```
 * RenderMessage → PSDOM.resolve() → Map<id, Directriz[]> → LayoutEngine → DirectiveApplicator → BoxRenderer
 * ```
 *
 * PSDOM reemplaza el `matchDirectives` simple del LayoutEngine. El LayoutEngine
 * consume el mapa pre-resuelto en vez de hacer matching propio.
 *
 * ## Ciclo de vida
 *
 * - Se instancia una vez cuando el Panel Browser arranca (junto al LayoutEngine)
 * - `resolve()` se llama en cada RenderMessage — es stateless entre llamadas
 * - `destroy()` se llama en shutdown del panel (remueve el iframe del DOM)
 *
 * ## Dependencia de orden con el Consolidator
 *
 * El orden de las directrices en el array de entrada determina quién gana en
 * empate de especificidad (última declaración gana). Ese orden lo fija el
 * `MessageConsolidator` en Rust, que fusiona archivos en orden alfabético por
 * path. Si el Consolidator cambia su orden de fusión, el resultado de cascada
 * cambia. Esta dependencia es intencional y documentada.
 *
 * ## Limitaciones del MVP
 *
 * - **Tracking de `source_file` en conflictos**: La detección de conflictos
 *   agrupa por selector distinto, no por archivo origen. Para reportar
 *   "archivo A vs archivo B" se necesita que `Directriz` lleve un campo
 *   `source_file` desde el crate Rust. Hoy se detecta que hay conflicto
 *   pero no se identifica de qué archivos vienen.
 *
 * - **Diffing incremental**: Cada `resolve()` reconstruye todo desde cero.
 *   No hay cache ni diff entre RenderMessages. Para árboles típicos de
 *   maquetación (decenas de nodos) esto es despreciable. Si escalara a
 *   cientos de nodos, se podría agregar cache de especificidad por selector.
 *
 * - **Variables CSS (`var(--x)`)**: No se resuelven. Si una directriz tiene
 *   `color: var(--primary)`, se trata como valor literal. Gap de mediano
 *   plazo — las custom properties son centrales en el flujo de trabajo
 *   moderno. Ver docs/PSDOM.md para el plan de resolución.
 *
 * - **`calc()`, `min()`, `max()`, `clamp()`**: Se pasan como strings
 *   literales. No se evalúan.
 *
 * - **`@keyframes`, `@font-face`**: No se procesan. Son features de
 *   rendering, no de selector matching.
 *
 * @example
 * ```ts
 * const psdom = new PSDOM();
 * const result = psdom.resolve(objects, directives);
 *
 * // result.directives — Map<id, Directriz[]> con especificidad y herencia resueltas
 * // result.invalidSelectors — selectores descartados por sintaxis inválida
 * // result.conflicts — conflictos entre directrices de selectores distintos
 *
 * psdom.destroy(); // solo en shutdown
 * ```
 */
import type { ObjetoHtml, Directriz } from '../types';
import { SelectorResolver } from './selector-resolver';
import { calculateSpecificity, resolveBySpecificity } from './specificity';
import type { Specificity } from './specificity';
import { resolveInheritance } from './inheritance';

/**
 * Conflicto entre directrices que apuntan al mismo nodo y misma propiedad
 * con selectores distintos.
 *
 * Indica que múltiples reglas CSS compiten por la misma propiedad en el
 * mismo elemento. El PSDOM resuelve el conflicto por especificidad/orden,
 * pero lo reporta para que el desarrollador pueda identificar solapamientos.
 *
 * **Limitación MVP**: No incluye `source_file` porque `Directriz` no lleva
 * ese campo desde Rust. Se agrupa por selector distinto como proxy.
 */
export interface DirectiveConflict {
  nodeId: string;
  property: string;
  candidates: {
    selector: string;
    value: string;
    specificity: Specificity;
    sourceFile?: string;
  }[];
}

/**
 * Resultado completo de un ciclo PSDOM.
 *
 * Contiene el mapa de directrices resueltas (listo para consumir por el
 * LayoutEngine), los selectores inválidos descartados, y los conflictos
 * detectados entre directrices.
 */
export interface ResolvedDirectives {
  /** Mapa de ID de ObjetoHtml → lista de Directrices resueltas (con especificidad y herencia) */
  directives: Map<string, Directriz[]>;
  /** Selectores descartados por sintaxis inválida */
  invalidSelectors: string[];
  /** Conflictos detectados entre directrices */
  conflicts: DirectiveConflict[];
}

/**
 * PSDOM Orchestrator.
 *
 * Coordina SelectorResolver, SpecificityCalculator e InheritanceResolver
 * para resolver la aplicación completa de directrices CSS sobre un árbol
 * de ObjetoHtml.
 *
 * Cada llamada a `resolve()` es un ciclo independiente y stateless:
 * construir árbol → matchear selectores → resolver especificidad →
 * resolver herencia → detectar conflictos → limpiar.
 *
 * @example
 * ```ts
 * const psdom = new PSDOM();
 *
 * // En cada RenderMessage:
 * const { directives, invalidSelectors, conflicts } = psdom.resolve(objects, dirs);
 *
 * // directives es Map<string, Directriz[]> listo para LayoutEngine
 * for (const [id, dirs] of directives) {
 *   // aplicar dirs al LayoutNode con ese id
 * }
 *
 * // En shutdown:
 * psdom.destroy();
 * ```
 */
export class PSDOM {
  private selectorResolver: SelectorResolver;

  /**
   * Crea una instancia de PSDOM con su SelectorResolver.
   *
   * @param doc - Document alternativo para inyección en tests.
   *   Si se omite, usa `document` global.
   */
  constructor(doc?: Document) {
    this.selectorResolver = new SelectorResolver(doc);
  }

  /**
   * Resuelve todas las directrices contra el árbol de objetos.
   *
   * Ejecuta el ciclo completo:
   * 1. Construir árbol DOM espejo en el contenedor
   * 2. Matchear cada selector via `querySelectorAll` nativo
   * 3. Agrupar directrices por nodo y propiedad
   * 4. Resolver especificidad (mayor gana, empate → última)
   * 5. Detectar conflictos multi-selector
   * 6. Resolver herencia (tree walk sobre ancestros)
   * 7. Limpiar contenedor
   *
   * @param objects - Raíces del árbol de ObjetoHtml
   * @param directives - Lista de directrices CSS a resolver
   * @returns Resultado con mapa de directrices, selectores inválidos y conflictos
   */
  resolve(objects: ObjetoHtml[], directives: Directriz[]): ResolvedDirectives {
    // 1. Construir árbol en el contenedor
    this.selectorResolver.buildTree(objects);

    // 2. Resolver selectores → agrupar por nodo y propiedad
    const matchMap = new Map<string, Map<string, Directriz[]>>();
    const invalidSelectors: string[] = [];

    for (const dir of directives) {
      const result = this.selectorResolver.matchSelector(dir.selector);
      if (!result.valid) {
        invalidSelectors.push(result.invalidSelector!);
        continue;
      }
      for (const id of result.ids) {
        if (!matchMap.has(id)) matchMap.set(id, new Map());
        const propMap = matchMap.get(id)!;
        if (!propMap.has(dir.property)) propMap.set(dir.property, []);
        propMap.get(dir.property)!.push(dir);
      }
    }

    // 3. Resolver especificidad por nodo/propiedad
    const resolvedMap = new Map<string, Directriz[]>();
    for (const [id, propMap] of matchMap) {
      const resolved: Directriz[] = [];
      for (const [, candidates] of propMap) {
        resolved.push(resolveBySpecificity(candidates));
      }
      resolvedMap.set(id, resolved);
    }

    // 4. Detectar conflictos multi-archivo (antes de herencia)
    const conflicts = this.detectConflicts(matchMap);

    // 5. Resolver herencia
    const finalMap = new Map<string, Directriz[]>();
    this.walkTree(objects, [], resolvedMap, finalMap);

    // 6. Limpiar contenedor
    this.selectorResolver.cleanup();

    return { directives: finalMap, invalidSelectors, conflicts };
  }

  /**
   * Destruye el resolver y libera recursos (remueve iframe del DOM).
   * Llamar solo en shutdown del panel. Después de `destroy()`, la
   * instancia no es reutilizable.
   */
  destroy(): void {
    this.selectorResolver.destroy();
  }

  private walkTree(
    objects: ObjetoHtml[],
    ancestorChain: string[],
    resolvedMap: Map<string, Directriz[]>,
    finalMap: Map<string, Directriz[]>,
  ): void {
    for (const obj of objects) {
      finalMap.set(obj.id, resolveInheritance(obj.id, resolvedMap, ancestorChain));
      this.walkTree(obj.children, [obj.id, ...ancestorChain], resolvedMap, finalMap);
    }
  }

  private detectConflicts(
    matchMap: Map<string, Map<string, Directriz[]>>,
  ): DirectiveConflict[] {
    const conflicts: DirectiveConflict[] = [];
    for (const [nodeId, propMap] of matchMap) {
      for (const [property, candidates] of propMap) {
        if (candidates.length < 2) continue;
        // Detectar si hay selectores distintos (indica posible conflicto multi-archivo)
        const uniqueSelectors = new Set(candidates.map(d => d.selector));
        if (uniqueSelectors.size > 1) {
          conflicts.push({
            nodeId,
            property,
            candidates: candidates.map(d => ({
              selector: d.selector,
              value: d.value,
              specificity: calculateSpecificity(d.selector),
              sourceFile: d.source_file,
            })),
          });
        }
      }
    }
    return conflicts;
  }
}
