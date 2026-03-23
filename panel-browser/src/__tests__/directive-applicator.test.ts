import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyDirectives } from '../directive-applicator';
import type { LayoutNode, Directriz, Zone } from '../types';

// --- Generators ---

const arbZone = (): fc.Arbitrary<Zone> => fc.constantFrom('top', 'center', 'bottom', 'background');

const arbLayoutNode = (directives: Directriz[] = []): fc.Arbitrary<LayoutNode> =>
  fc.record({
    id: fc.string({ minLength: 4, maxLength: 8, unit: fc.constantFrom(...'abcdef0123456789'.split('')) }),
    tag: fc.constantFrom('div', 'p', 'span', 'section'),
    x: fc.integer({ min: 0, max: 500 }),
    y: fc.integer({ min: 0, max: 500 }),
    width: fc.integer({ min: 10, max: 800 }),
    height: fc.integer({ min: 10, max: 600 }),
    zone: arbZone(),
  }).map(n => ({
    ...n,
    children: [],
    directives,
    sourceFile: undefined,
  }));

// --- Property 8: display:none elimina del layout ---
// Validates: Requirements 4.2
describe('Property 8: display:none elimina del layout', () => {
  it('nodes with display:none are excluded from output', () => {
    fc.assert(
      fc.property(
        arbLayoutNode([{ selector: 'div', property: 'display', value: 'none' }]),
        arbLayoutNode([]),
        (hiddenNode, visibleNode) => {
          fc.pre(hiddenNode.id !== visibleNode.id);
          const result = applyDirectives([hiddenNode, visibleNode]);
          // Hidden node should be filtered out
          const ids = result.map(n => n.id);
          expect(ids).not.toContain(hiddenNode.id);
          expect(ids).toContain(visibleNode.id);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('hidden children are excluded from parent', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 8, unit: fc.constantFrom(...'abcdef0123456789'.split('')) }),
        fc.string({ minLength: 4, maxLength: 8, unit: fc.constantFrom(...'abcdef0123456789'.split('')) }),
        (parentId, childId) => {
          fc.pre(parentId !== childId);
          const child: LayoutNode = {
            id: childId, tag: 'span', x: 0, y: 0, width: 100, height: 50,
            children: [], directives: [{ selector: 'span', property: 'display', value: 'none' }],
            zone: 'center',
          };
          const parent: LayoutNode = {
            id: parentId, tag: 'div', x: 0, y: 0, width: 200, height: 100,
            children: [child], directives: [], zone: 'center',
          };
          const result = applyDirectives([parent]);
          expect(result[0].children.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 9: max-width restringe sin exceder ---
// Validates: Requirements 4.5
describe('Property 9: max-width restringe sin exceder', () => {
  it('width never exceeds max-width after applying', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 800 }),
        fc.integer({ min: 10, max: 400 }),
        (initialWidth, maxWidth) => {
          const node: LayoutNode = {
            id: 'test', tag: 'div', x: 0, y: 0,
            width: initialWidth, height: 100,
            children: [], zone: 'center',
            directives: [{ selector: 'div', property: 'max-width', value: `${maxWidth}px` }],
          };
          const result = applyDirectives([node]);
          expect(result[0].width).toBeLessThanOrEqual(maxWidth);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 10: Propiedad inválida preserva estado ---
// Validates: Requirements 4.7
describe('Property 10: Propiedad inválida preserva estado', () => {
  it('invalid dimension values do not change node dimensions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 800 }),
        fc.integer({ min: 10, max: 600 }),
        fc.constantFrom('width', 'height', 'max-width'),
        fc.constantFrom('abc', 'invalid', '???', ''),
        (w, h, prop, badVal) => {
          const node: LayoutNode = {
            id: 'test', tag: 'div', x: 0, y: 0,
            width: w, height: h,
            children: [], zone: 'center',
            directives: [{ selector: 'div', property: prop, value: badVal }],
          };
          const result = applyDirectives([node]);
          // Invalid values should not change dimensions
          if (prop === 'width') expect(result[0].width).toBe(w);
          if (prop === 'height') expect(result[0].height).toBe(h);
          if (prop === 'max-width') expect(result[0].width).toBe(w); // Infinity fallback, no change
        },
      ),
      { numRuns: 100 },
    );
  });
});
