/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { PSDOM } from '../psdom/psdom';
import type { ObjetoHtml, Directriz } from '../types';

// --- Generators ---

const arbId = () =>
  fc.string({ minLength: 4, maxLength: 8, unit: fc.constantFrom(...'abcdef0123456789'.split('')) });

const arbTag = () =>
  fc.constantFrom('div', 'p', 'span', 'h1', 'section', 'header', 'article');

const arbClassName = () =>
  fc.constantFrom('main', 'active', 'hidden', 'container', 'wrapper');

const arbObjetoHtmlLeaf = (): fc.Arbitrary<ObjetoHtml> =>
  fc.record({
    id: arbId(),
    tag: arbTag(),
    children: fc.constant([] as ObjetoHtml[]),
    attributes: fc.array(
      fc.tuple(fc.constant('class'), arbClassName()),
      { minLength: 0, maxLength: 1 },
    ),
  });

const arbObjetoHtmlWithChildren = (): fc.Arbitrary<ObjetoHtml> =>
  fc.record({
    id: arbId(),
    tag: arbTag(),
    children: fc.array(arbObjetoHtmlLeaf(), { minLength: 1, maxLength: 3 }),
    attributes: fc.array(
      fc.tuple(fc.constant('class'), arbClassName()),
      { minLength: 0, maxLength: 1 },
    ),
  });

const arbDirectriz = (selector: string): fc.Arbitrary<Directriz> =>
  fc.record({
    selector: fc.constant(selector),
    property: fc.constantFrom('color', 'width', 'height', 'font-size'),
    value: fc.constantFrom('red', '100px', '200px', '16px', 'blue'),
  });

// --- Helpers ---

function mapToObj(map: Map<string, Directriz[]>): Record<string, Directriz[]> {
  const obj: Record<string, Directriz[]> = {};
  for (const [k, v] of map) obj[k] = v;
  return obj;
}

let psdom: PSDOM;

beforeEach(() => {
  psdom = new PSDOM(document);
});

afterEach(() => {
  psdom.destroy();
});

// --- Property 3: Ciclo stateless sin contaminación ---
// Feature: psdom, Property 3: Ciclo stateless sin contaminación
// Validates: Requirements 1.6, 6.2, 6.3
describe('Property 3: Ciclo stateless sin contaminación', () => {
  it('second cycle produces same result as running it on a fresh instance', () => {
    // Use a single fresh instance for comparison (created once, not per iteration)
    const fresh = new PSDOM(document);

    fc.assert(
      fc.property(
        arbObjetoHtmlLeaf(),
        arbObjetoHtmlLeaf(),
        arbTag(),
        arbTag(),
        (obj1, obj2, tag1, tag2) => {
          // Ensure distinct objects
          fc.pre(obj1.id !== obj2.id);

          const dir1: Directriz = { selector: tag1, property: 'color', value: 'red' };
          const dir2: Directriz = { selector: tag2, property: 'color', value: 'blue' };

          // First cycle with obj1
          psdom.resolve([obj1], [dir1]);

          // Second cycle with obj2
          const result2 = psdom.resolve([obj2], [dir2]);

          // Fresh instance with same input (reuse fresh, it's stateless)
          const resultFresh = fresh.resolve([obj2], [dir2]);

          // Compare: second cycle should equal fresh instance
          const r2Obj = mapToObj(result2.directives);
          const rFreshObj = mapToObj(resultFresh.directives);
          expect(r2Obj).toEqual(rFreshObj);
          expect(result2.invalidSelectors).toEqual(resultFresh.invalidSelectors);
        },
      ),
      { numRuns: 100 },
    );

    fresh.destroy();
  });
});

// --- Property 8: Detección de conflictos multi-archivo ---
// Feature: psdom, Property 8: Detección de conflictos multi-archivo
// Validates: Requirements 5.1, 5.2
describe('Property 8: Detección de conflictos multi-archivo', () => {
  it('detects conflicts when different selectors target same node and property', () => {
    fc.assert(
      fc.property(
        arbId(),
        arbClassName(),
        fc.constantFrom('color', 'width', 'font-size'),
        fc.constantFrom('red', '100px', '16px'),
        fc.constantFrom('blue', '200px', '20px'),
        (id, cls, prop, val1, val2) => {
          fc.pre(val1 !== val2);

          const obj: ObjetoHtml = {
            id,
            tag: 'div',
            children: [],
            attributes: [['class', cls]],
          };

          // Two directives with different selectors targeting same node
          const dir1: Directriz = { selector: 'div', property: prop, value: val1 };
          const dir2: Directriz = { selector: `.${cls}`, property: prop, value: val2 };

          const result = psdom.resolve([obj], [dir1, dir2]);

          // Should detect a conflict
          expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
          const conflict = result.conflicts.find(c => c.nodeId === id && c.property === prop);
          expect(conflict).toBeDefined();
          expect(conflict!.candidates.length).toBe(2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no conflicts when single directive per node/property', () => {
    fc.assert(
      fc.property(
        arbObjetoHtmlLeaf(),
        fc.constantFrom('color', 'width'),
        fc.constantFrom('red', '100px'),
        (obj, prop, val) => {
          const dir: Directriz = { selector: obj.tag, property: prop, value: val };
          const result = psdom.resolve([obj], [dir]);
          expect(result.conflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
