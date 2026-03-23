import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { BoxRenderer } from '../box-renderer';
import { LayoutEngine } from '../layout-engine';
import type { ObjetoHtml, LayoutNode } from '../types';

const arbSemanticTag = () =>
  fc.constantFrom('header', 'nav', 'footer', 'section', 'div');

const arbId = () => fc.string({ minLength: 4, maxLength: 8, unit: fc.constantFrom(...'0123456789abcdef'.split('')) });

const arbObjetoHtml = (): fc.Arbitrary<ObjetoHtml> =>
  fc.record({
    id: arbId(),
    tag: arbSemanticTag(),
    children: fc.constant([] as ObjetoHtml[]),
    attributes: fc.constant([] as [string, string][]),
  });

// --- Property 12: Box rendering includes identification ---
// Feature: real-time-mvp, Property 12: Box rendering includes identification
// Validates: Requirements 6.1
describe('Property 12: Box rendering includes identification', () => {
  it('every rendered node has a rect and a text label with tag name', () => {
    fc.assert(
      fc.property(arbObjetoHtml(), (obj) => {
        const engine = new LayoutEngine(800, 600);
        const nodes = engine.computeLayout([obj], []);
        const renderer = new BoxRenderer();
        const commands = renderer.render(nodes);

        // Should have at least one rect command (border)
        const rects = commands.filter(c => c.type === 'rect');
        expect(rects.length).toBeGreaterThanOrEqual(1);

        // Should have at least one text command with the tag name
        const texts = commands.filter(c => c.type === 'text');
        expect(texts.length).toBeGreaterThanOrEqual(1);
        const hasTagLabel = texts.some(t => t.label?.includes(obj.tag));
        expect(hasTagLabel).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Helper ---
function checkContainment(parent: LayoutNode, child: LayoutNode): boolean {
  return (
    child.x >= parent.x &&
    child.y >= parent.y &&
    child.x + child.width <= parent.x + parent.width &&
    child.y + child.height <= parent.y + parent.height
  );
}

function checkAllContainment(node: LayoutNode): boolean {
  for (const child of node.children) {
    if (!checkContainment(node, child)) return false;
    if (!checkAllContainment(child)) return false;
  }
  return true;
}

// --- Property 13: Nested boxes spatial containment ---
// Feature: real-time-mvp, Property 13: Nested boxes spatial containment
// Validates: Requirements 6.2
describe('Property 13: Nested boxes spatial containment', () => {
  it('child boxes are spatially contained within parent boxes', () => {
    fc.assert(
      fc.property(arbId(), arbSemanticTag(), arbId(), arbSemanticTag(), (parentId, parentTag, childId, childTag) => {
        const obj: ObjetoHtml = {
          id: parentId,
          tag: parentTag,
          children: [{
            id: childId,
            tag: childTag,
            children: [],
            attributes: [],
          }],
          attributes: [],
        };
        const engine = new LayoutEngine(800, 600);
        const nodes = engine.computeLayout([obj], []);

        for (const node of nodes) {
          expect(checkAllContainment(node)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
