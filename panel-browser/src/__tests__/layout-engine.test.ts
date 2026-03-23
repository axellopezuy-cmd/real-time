import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { LayoutEngine } from '../layout-engine';
import type { ObjetoHtml, Directriz } from '../types';

// --- Generators ---

const arbTag = () => fc.constantFrom('div', 'span', 'header', 'section', 'footer', 'nav', 'p');

const arbObjetoHtml = (): fc.Arbitrary<ObjetoHtml> =>
  fc.record({
    id: fc.string({ minLength: 4, maxLength: 8, unit: fc.constantFrom(...'abcdef0123456789'.split('')) }),
    tag: arbTag(),
    children: fc.constant([] as ObjetoHtml[]),
    attributes: fc.constant([] as [string, string][]),
  });

const arbDirectriz = (): fc.Arbitrary<Directriz> =>
  fc.record({
    selector: arbTag(),
    property: fc.constantFrom('color', 'width', 'height'),
    value: fc.constantFrom('red', '100px', '50px'),
  });

const arbRenderMessage = () =>
  fc.record({
    objects: fc.array(arbObjetoHtml(), { minLength: 1, maxLength: 5 }),
    directives: fc.array(arbDirectriz(), { minLength: 0, maxLength: 5 }),
  });

const arbDimensions = () =>
  fc.record({
    width: fc.integer({ min: 200, max: 2000 }),
    height: fc.integer({ min: 200, max: 2000 }),
  });

// --- Property 11: Layout determinista por dimensiones ---
// Validates: Requirements 6.2
describe('Property 11: Layout determinista por dimensiones', () => {
  it('same input + same dimensions = same output', () => {
    fc.assert(
      fc.property(
        arbRenderMessage(),
        arbDimensions(),
        ({ objects, directives }, { width, height }) => {
          const engine1 = new LayoutEngine(width, height);
          const engine2 = new LayoutEngine(width, height);

          const result1 = engine1.computeLayout(objects, directives);
          const result2 = engine2.computeLayout(objects, directives);

          // Strip functions for comparison
          const strip = (nodes: any[]) => JSON.stringify(nodes.map(n => ({
            id: n.id, x: n.x, y: n.y, width: n.width, height: n.height, zone: n.zone,
          })));

          expect(strip(result1)).toBe(strip(result2));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 12: Contenido dentro de los límites del canvas ---
// Validates: Requirements 6.2
describe('Property 12: Contenido dentro de los límites del canvas', () => {
  it('all top-level nodes start within canvas bounds', () => {
    fc.assert(
      fc.property(
        arbRenderMessage(),
        arbDimensions(),
        ({ objects, directives }, { width, height }) => {
          const engine = new LayoutEngine(width, height);
          const result = engine.computeLayout(objects, directives);

          for (const node of result) {
            // x should be >= 0
            expect(node.x).toBeGreaterThanOrEqual(0);
            // y should be >= 0
            expect(node.y).toBeGreaterThanOrEqual(0);
            // Background nodes fill the canvas, others should start within
            if (node.zone !== 'background') {
              expect(node.x).toBeLessThanOrEqual(width);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
