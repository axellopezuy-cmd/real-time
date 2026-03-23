/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { SelectorResolver } from '../psdom/selector-resolver';
import type { ObjetoHtml } from '../types';

// --- Generators ---

let idCounter = 0;
const nextId = () => `node-${idCounter++}`;

const arbTag = () => fc.constantFrom('div', 'p', 'span', 'ul', 'li', 'h1', 'section', 'header', 'nav', 'a');
const arbClassName = () => fc.constantFrom('main', 'active', 'hidden', 'container', 'item', 'wrapper');
const arbIdName = () => fc.constantFrom('app', 'root', 'content', 'sidebar', 'panel');

const arbObjetoHtmlLeaf = (): fc.Arbitrary<ObjetoHtml> =>
  fc.record({
    tag: arbTag(),
    className: fc.option(arbClassName(), { nil: undefined }),
    idName: fc.option(arbIdName(), { nil: undefined }),
  }).map(({ tag, className, idName }) => {
    const attrs: [string, string][] = [];
    if (className) attrs.push(['class', className]);
    if (idName) attrs.push(['id', idName]);
    return {
      id: nextId(),
      tag,
      children: [] as ObjetoHtml[],
      attributes: attrs,
    };
  });

const arbObjetoHtmlTree = (maxDepth: number = 2): fc.Arbitrary<ObjetoHtml> => {
  if (maxDepth <= 0) return arbObjetoHtmlLeaf();
  return fc.record({
    tag: arbTag(),
    className: fc.option(arbClassName(), { nil: undefined }),
    idName: fc.option(arbIdName(), { nil: undefined }),
    children: fc.array(arbObjetoHtmlTree(maxDepth - 1), { minLength: 0, maxLength: 3 }),
  }).map(({ tag, className, idName, children }) => {
    const attrs: [string, string][] = [];
    if (className) attrs.push(['class', className]);
    if (idName) attrs.push(['id', idName]);
    return {
      id: nextId(),
      tag,
      children,
      attributes: attrs,
    };
  });
};

function collectIds(obj: ObjetoHtml): string[] {
  return [obj.id, ...obj.children.flatMap(collectIds)];
}

function countNodes(objects: ObjetoHtml[]): number {
  return objects.reduce((sum, obj) => sum + 1 + obj.children.reduce((s, c) => s + countNodesInTree(c), 0), 0);
}

function countNodesInTree(obj: ObjetoHtml): number {
  return 1 + obj.children.reduce((sum, c) => sum + countNodesInTree(c), 0);
}

// --- Tests ---

let resolver: SelectorResolver;

beforeEach(() => {
  idCounter = 0;
  resolver = new SelectorResolver();
});

afterEach(() => {
  resolver.destroy();
});

// --- Property 1: Construcción fidedigna del árbol PSDOM ---
// Feature: psdom, Property 1: Construcción fidedigna del árbol PSDOM
// Validates: Requirements 1.1, 1.7
describe('Property 1: Construcción fidedigna del árbol PSDOM', () => {
  it('cada ObjetoHtml produce un nodo con data-rt-id correspondiente', () => {
    fc.assert(
      fc.property(
        fc.array(arbObjetoHtmlTree(2), { minLength: 1, maxLength: 4 }),
        (objects) => {
          resolver.buildTree(objects);
          const allIds = objects.flatMap(collectIds);
          // Verificar que cada ID tiene un nodo en el contenedor
          expect(resolver.nodeCount).toBe(allIds.length);
          // Verificar que cada ID es matcheable
          for (const id of allIds) {
            const result = resolver.matchSelector(`[data-rt-id="${id}"]`);
            expect(result.valid).toBe(true);
            expect(result.ids).toContain(id);
          }
          resolver.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('preserva tag de cada nodo', () => {
    const obj: ObjetoHtml = {
      id: 'test-1',
      tag: 'section',
      children: [{ id: 'test-2', tag: 'div', children: [], attributes: [] }],
      attributes: [],
    };
    resolver.buildTree([obj]);
    // section debe existir
    const sections = resolver.matchSelector('section');
    expect(sections.ids).toContain('test-1');
    // div dentro de section
    const divs = resolver.matchSelector('section > div');
    expect(divs.ids).toContain('test-2');
  });

  it('preserva class y id como atributos', () => {
    const obj: ObjetoHtml = {
      id: 'test-1',
      tag: 'div',
      children: [],
      attributes: [['class', 'main'], ['id', 'app']],
    };
    resolver.buildTree([obj]);
    expect(resolver.matchSelector('.main').ids).toContain('test-1');
    expect(resolver.matchSelector('#app').ids).toContain('test-1');
  });
});

// --- Property 7: Validación defensiva ---
// Feature: psdom, Property 7: Validación defensiva — selector inválido descartado sin interrumpir
// Validates: Requirements 4.1, 4.2, 4.3
describe('Property 7: Validación defensiva — selector inválido descartado sin interrumpir', () => {
  it('selectores inválidos retornan valid=false sin interrumpir', () => {
    const invalidSelectors = ['[[[', '##bad', '...nope', '{invalid}', 'div[', '::(bad)'];
    const obj: ObjetoHtml = {
      id: 'test-1', tag: 'div', children: [], attributes: [],
    };
    resolver.buildTree([obj]);

    for (const sel of invalidSelectors) {
      const result = resolver.matchSelector(sel);
      expect(result.valid).toBe(false);
      expect(result.ids).toEqual([]);
      expect(result.invalidSelector).toBe(sel);
    }

    // Selectores válidos siguen funcionando después de los inválidos
    const validResult = resolver.matchSelector('div');
    expect(validResult.valid).toBe(true);
    expect(validResult.ids).toContain('test-1');
  });

  it('mezcla de selectores válidos e inválidos: los válidos se procesan correctamente', () => {
    fc.assert(
      fc.property(
        fc.array(arbObjetoHtmlLeaf(), { minLength: 1, maxLength: 5 }),
        (objects) => {
          resolver.buildTree(objects);

          // Selector inválido
          const invalid = resolver.matchSelector('[[[bad');
          expect(invalid.valid).toBe(false);

          // Selector válido que matchea por tag
          const tag = objects[0].tag;
          const valid = resolver.matchSelector(tag);
          expect(valid.valid).toBe(true);
          // Al menos el primer objeto debería matchear
          expect(valid.ids.length).toBeGreaterThanOrEqual(1);

          resolver.cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('selector válido sin matches retorna lista vacía con valid=true', () => {
    const obj: ObjetoHtml = {
      id: 'test-1', tag: 'div', children: [], attributes: [],
    };
    resolver.buildTree([obj]);
    const result = resolver.matchSelector('span.nonexistent');
    expect(result.valid).toBe(true);
    expect(result.ids).toEqual([]);
  });
});

// Unit tests para selectores complejos
describe('SelectorResolver: selectores complejos', () => {
  it('combinador descendiente: ul li', () => {
    const tree: ObjetoHtml = {
      id: 'ul-1', tag: 'ul', attributes: [],
      children: [
        { id: 'li-1', tag: 'li', children: [], attributes: [] },
        { id: 'li-2', tag: 'li', children: [], attributes: [] },
      ],
    };
    resolver.buildTree([tree]);
    const result = resolver.matchSelector('ul li');
    expect(result.ids).toEqual(['li-1', 'li-2']);
  });

  it('combinador hijo directo: div > p', () => {
    const tree: ObjetoHtml = {
      id: 'div-1', tag: 'div', attributes: [],
      children: [
        {
          id: 'p-1', tag: 'p', attributes: [],
          children: [
            { id: 'span-1', tag: 'span', children: [], attributes: [] },
          ],
        },
      ],
    };
    resolver.buildTree([tree]);
    const result = resolver.matchSelector('div > p');
    expect(result.ids).toEqual(['p-1']);
    // span no es hijo directo de div
    const spanResult = resolver.matchSelector('div > span');
    expect(spanResult.ids).toEqual([]);
  });

  it(':nth-child pseudoclase estructural', () => {
    const tree: ObjetoHtml = {
      id: 'ul-1', tag: 'ul', attributes: [],
      children: [
        { id: 'li-1', tag: 'li', children: [], attributes: [] },
        { id: 'li-2', tag: 'li', children: [], attributes: [] },
        { id: 'li-3', tag: 'li', children: [], attributes: [] },
      ],
    };
    resolver.buildTree([tree]);
    const result = resolver.matchSelector('li:nth-child(2)');
    expect(result.ids).toEqual(['li-2']);
  });

  it(':not() pseudoclase', () => {
    const objects: ObjetoHtml[] = [
      { id: 'div-1', tag: 'div', children: [], attributes: [['class', 'active']] },
      { id: 'div-2', tag: 'div', children: [], attributes: [['class', 'hidden']] },
      { id: 'div-3', tag: 'div', children: [], attributes: [] },
    ];
    resolver.buildTree(objects);
    const result = resolver.matchSelector('div:not(.hidden)');
    expect(result.ids).toContain('div-1');
    expect(result.ids).toContain('div-3');
    expect(result.ids).not.toContain('div-2');
  });

  it('selector de atributo: [data-role="main"]', () => {
    const objects: ObjetoHtml[] = [
      { id: 'div-1', tag: 'div', children: [], attributes: [['data-role', 'main']] },
      { id: 'div-2', tag: 'div', children: [], attributes: [['data-role', 'sidebar']] },
    ];
    resolver.buildTree(objects);
    const result = resolver.matchSelector('[data-role="main"]');
    expect(result.ids).toEqual(['div-1']);
  });
});
