/**
 * @module selector-resolver
 *
 * Resolución de selectores CSS delegando al motor nativo del browser via
 * `querySelectorAll`.
 *
 * El SelectorResolver construye un árbol DOM espejo del árbol de ObjetoHtml
 * dentro de un contenedor aislado (iframe en producción, div en tests).
 * Cada nodo del espejo lleva un atributo `data-rt-id` que permite mapear
 * los resultados de `querySelectorAll` de vuelta a los ObjetoHtml originales.
 *
 * ## Estrategia de aislamiento
 *
 * En browser real se usa un iframe permanente invisible (`srcdoc=""`,
 * `visibility:hidden`, dimensiones 0×0). Esto garantiza:
 * - No interfiere con el panel de renderizado
 * - No dispara reflows en el documento principal
 * - `querySelectorAll` funciona con el motor nativo completo
 * - Aislamiento total de estilos (no hereda CSS del panel)
 *
 * En entornos de test (happy-dom, jsdom) donde el iframe puede no tener
 * `contentDocument` disponible sincrónicamente, se usa un `<div>` desconectado
 * como fallback. El comportamiento de `querySelectorAll` es idéntico.
 *
 * ## Ciclo de vida del iframe
 *
 * - **Creación**: En el constructor de `SelectorResolver` (que se llama desde
 *   el constructor de `PSDOM`). Se crea una sola vez cuando el Panel Browser
 *   arranca.
 * - **Uso**: `buildTree()` llena el iframe, `matchSelector()` consulta,
 *   `cleanup()` vacía el contenido. Esto ocurre en cada `PSDOM.resolve()`.
 * - **Destrucción**: `destroy()` remueve el iframe del DOM. Lo llama
 *   `PSDOM.destroy()`, que a su vez lo invoca el WebSocketClient o el
 *   Launcher en shutdown del panel.
 *
 * ## Limitaciones del MVP
 *
 * - **Pseudoclases dinámicas** (`:hover`, `:focus`, `:active`, `:visited`):
 *   Son sintácticamente válidas y `querySelectorAll` las acepta, pero nunca
 *   matchean porque no hay interacción de usuario en el iframe. Un selector
 *   como `a:hover` retorna lista vacía, no error.
 *
 * - **Media queries**: El iframe tiene dimensiones 0×0. Selectores dentro de
 *   `@media` no se procesan aquí (las media queries se resuelven a nivel de
 *   regla, no de selector). Si en el futuro se quisiera soportar media queries,
 *   habría que sincronizar las dimensiones del iframe con el viewport del panel.
 *
 * - **Selectores de atributo case-insensitive** (`[attr="val" i]`): Depende
 *   del soporte del browser/happy-dom. Debería funcionar pero no se testea
 *   explícitamente.
 *
 * - **Shadow DOM real**: No se usa `attachShadow`. El nombre PSDOM es
 *   conceptual. No hay shadow boundaries ni encapsulación de estilos.
 *
 * @example
 * ```ts
 * const resolver = new SelectorResolver();
 * resolver.buildTree(objects);
 * const result = resolver.matchSelector('div > p.active');
 * // result.ids contiene los IDs de ObjetoHtml que matchean
 * resolver.cleanup();
 * ```
 */
import type { ObjetoHtml } from '../types';

/**
 * Resultado de resolver un selector contra el árbol PSDOM.
 *
 * Si `valid` es `false`, el selector tenía sintaxis inválida y fue descartado.
 * Si `valid` es `true` pero `ids` está vacío, el selector es válido pero no
 * matchea ningún nodo (esto NO es un error).
 */
export interface SelectorResult {
  /** true si el selector tiene sintaxis válida */
  valid: boolean;
  /** IDs de ObjetoHtml que matchean el selector */
  ids: string[];
  /** Selector original si fue inválido (para diagnóstico) */
  invalidSelector?: string;
}

/**
 * Resuelve selectores CSS usando `querySelectorAll` nativo del browser.
 *
 * Usa un contenedor DOM aislado para no interferir con el panel de renderizado.
 * En browser real usa un iframe permanente invisible; en tests usa un div
 * desconectado como fallback.
 *
 * @example
 * ```ts
 * const resolver = new SelectorResolver();
 * resolver.buildTree(objects);
 *
 * const r1 = resolver.matchSelector('div > p');
 * // r1.valid === true, r1.ids === ['id-1', 'id-3']
 *
 * const r2 = resolver.matchSelector('!!!invalid');
 * // r2.valid === false, r2.invalidSelector === '!!!invalid'
 *
 * resolver.cleanup();
 * resolver.destroy(); // solo en shutdown
 * ```
 */
export class SelectorResolver {
  private container: HTMLElement;
  private doc: Document;
  private useIframe: boolean;
  private iframe: HTMLIFrameElement | null = null;

  /**
   * Crea un SelectorResolver con un contenedor DOM aislado.
   *
   * @param externalDoc - Document alternativo para inyección en tests.
   *   Si se omite, usa `document` global. En happy-dom/jsdom, pasar
   *   el document del entorno de test.
   */
  constructor(externalDoc?: Document) {
    const baseDoc = externalDoc || document;
    // Intentar crear iframe; si no es posible (test env), usar div
    try {
      this.iframe = baseDoc.createElement('iframe');
      this.iframe.srcdoc = '';
      this.iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
      baseDoc.body.appendChild(this.iframe);

      // Esperar a que el iframe tenga contentDocument
      if (this.iframe.contentDocument && this.iframe.contentDocument.body) {
        this.doc = this.iframe.contentDocument;
        this.container = this.doc.body;
        this.useIframe = true;
      } else {
        // Fallback: usar div en el document actual
        this.container = baseDoc.createElement('div');
        this.doc = baseDoc;
        this.useIframe = false;
        if (this.iframe.parentNode) this.iframe.parentNode.removeChild(this.iframe);
        this.iframe = null;
      }
    } catch {
      // Fallback para entornos sin DOM completo
      this.container = baseDoc.createElement('div');
      this.doc = baseDoc;
      this.useIframe = false;
    }
  }

  /**
   * Construye el árbol DOM espejo desde un array de ObjetoHtml.
   *
   * Limpia el contenido previo del contenedor y crea nodos HTML
   * preservando tag, id, class, atributos y estructura de hijos.
   * Cada nodo recibe `data-rt-id` con el ID del ObjetoHtml para
   * mapeo inverso.
   *
   * @param objects - Raíces del árbol de ObjetoHtml a espejar
   */
  buildTree(objects: ObjetoHtml[]): void {
    this.container.innerHTML = '';
    for (const obj of objects) {
      this.container.appendChild(this.createNode(obj));
    }
  }

  /**
   * Ejecuta `querySelectorAll` con el selector dado y retorna los IDs
   * de los ObjetoHtml que matchean.
   *
   * Si el selector tiene sintaxis inválida, `querySelectorAll` lanza
   * `DOMException`. El método la captura y retorna `{ valid: false }`
   * sin interrumpir el flujo (diseño defensivo).
   *
   * @param selector - Selector CSS a evaluar
   * @returns Resultado con IDs matcheados o indicador de selector inválido
   */
  matchSelector(selector: string): SelectorResult {
    try {
      const nodes = this.container.querySelectorAll(selector);
      const ids: string[] = [];
      nodes.forEach(n => {
        const id = (n as HTMLElement).dataset.rtId;
        if (id) ids.push(id);
      });
      return { valid: true, ids };
    } catch {
      return { valid: false, ids: [], invalidSelector: selector };
    }
  }

  /**
   * Limpia el contenido del contenedor (entre ciclos PSDOM).
   * El contenedor mismo persiste; solo se vacía su innerHTML.
   */
  cleanup(): void {
    this.container.innerHTML = '';
  }

  /**
   * Destruye el resolver y remueve el iframe del DOM.
   * Llamar solo en shutdown del panel. Después de `destroy()`,
   * el resolver no es reutilizable.
   */
  destroy(): void {
    this.cleanup();
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    }
  }

  /**
   * Retorna el número de nodos con `data-rt-id` actualmente en el contenedor.
   * Útil para verificación en tests.
   */
  get nodeCount(): number {
    return this.container.querySelectorAll('[data-rt-id]').length;
  }

  private createNode(obj: ObjetoHtml): HTMLElement {
    const el = this.doc.createElement(obj.tag);
    el.dataset.rtId = obj.id;
    for (const [key, value] of obj.attributes) {
      if (key === 'id') el.id = value;
      else if (key === 'class') el.className = value;
      else el.setAttribute(key, value);
    }
    for (const child of obj.children) {
      el.appendChild(this.createNode(child));
    }
    return el;
  }
}
