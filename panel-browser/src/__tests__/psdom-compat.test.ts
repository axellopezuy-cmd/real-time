/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { LayoutEngine } from '../layout-engine';
import { PSDOM } from '../psdom/psdom';
import type { ObjetoHtml, Directriz, LayoutNode } from '../types';

// --- Generators ---

const arbId = () =>
  fc.string({ minLength: 4, maxLength: 8, unit: fc.constantFrom(...'abcdef0123456789'.split('')) });

const arbSemanticTag = () =>
  fc.constantFrom('header', 'nav', 'footer', 'section', 'div');

const arbClassName = () =>
  fc.constantFrom('main', 'active', 'hidden', 'container');

/** Generate simple selectors: tag, .class, or #id */
const arbSimpleSelector = (tag: string, cls?: string, idAttr?: string): fc.Arbitrary<string> => {
  const options: string[] = [tag];
  if (cls) options.push(`.${cls}`);
  if (idAttr) options.push(`#${idAttr}`);
  return fc.constantFrom(...options);
};

const arbObjetoHtml = (): fc.Arbitrary<ObjetoHtml> =>
  fc.record({
    id: arbId(),
    tag: arbSemanticTag(),
    children: fc.constant([] as ObjetoHtml[]),
    attributes: fc.oneof(
      fc.constant([] as [string, string][]),
      fc.tuple(fc.constant('class' as const), arbClassName()).map(t => [t] as [string, string][]),
      fc.tuple(fc.constant('id' as const), arbId()).map(t => [t] as [string, string][]),
    ),
  });

// --- Helpers ---

function getDirectivesForNode(nodes: LayoutNode[], nodeId: string): Directriz[] {
  for (const node of nodes) {
    if (node.id === nodeId) return node.directives;
    const found = getDirectivesForNode(node.children, nodeId);
    if (found.length > 0) return found;
  }
  return [];
}

/** Extract only non-inherited, non-default directives (the ones from actual CSS matching) */
function filterExplicitDirectives(directives: Directriz[]): Directriz[] {
  return directives.filter(d => d.selector !== 'inherited' && d.selector !== 'default');
}

let psdom: PSDOM;

beforeEach(() => {
  psdom = new PSDOM(document);
});

afterEach(() => {
  psdom.destroy();
});

// --- Property 9: Compatibilidad hacia atrás con selectores simples ---
// Feature: psdom, Property 9: Compatibilidad hacia atrás con selectores simples
// Validates: Requirements 7.2
describe('Property 9: Compatibilidad hacia atrás con selectores simples', () => {
  it('PSDOM produces same matching as old matchDirectives for tag selectors', () => {
    fc.assert(
      fc.property(
        arbObjetoHtml(),
        fc.constantFrom('width', 'height', 'color'),
        fc.constantFrom('100px', '200px', 'red'),
        (obj, prop, val) => {
          const dir: Directriz = { selector: obj.tag, property: prop, value: val };
          const engine = new LayoutEngine(800, 600);

          // Old way: no PSDOM
          const oldResult = engine.computeLayout([obj], [dir]);
          const oldDirs = getDirectivesForNode(oldResult, obj.id);

          // New way: with PSDOM
          const resolved = psdom.resolve([obj], [dir]);
          const newResult = engine.computeLayout([obj], [dir], resolved.directives);
          const newDirs = filterExplicitDirectives(getDirectivesForNode(newResult, obj.id));

          // Both should match the same directives
          expect(newDirs.map(d => ({ s: d.selector, p: d.property, v: d.value })))
            .toEqual(oldDirs.map(d => ({ s: d.selector, p: d.property, v: d.value })));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('PSDOM produces same matching as old matchDirectives for class selectors', () => {
    fc.assert(
      fc.property(
        arbId(),
        arbSemanticTag(),
        arbClassName(),
        fc.constantFrom('width', 'color'),
        fc.constantFrom('100px', 'red'),
        (id, tag, cls, prop, val) => {
          const obj: ObjetoHtml = {
            id,
            tag,
            children: [],
            attributes: [['class', cls]],
          };
          const dir: Directriz = { selector: `.${cls}`, property: prop, value: val };
          const engine = new LayoutEngine(800, 600);

          const oldResult = engine.computeLayout([obj], [dir]);
          const oldDirs = getDirectivesForNode(oldResult, id);

          const resolved = psdom.resolve([obj], [dir]);
          const newResult = engine.computeLayout([obj], [dir], resolved.directives);
          const newDirs = filterExplicitDirectives(getDirectivesForNode(newResult, id));

          expect(newDirs.map(d => ({ s: d.selector, p: d.property, v: d.value })))
            .toEqual(oldDirs.map(d => ({ s: d.selector, p: d.property, v: d.value })));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('PSDOM produces same matching as old matchDirectives for ID selectors', () => {
    // CSS ID selectors must start with a letter or underscore, not a digit
    const arbCssValidId = () =>
      fc.string({ minLength: 3, maxLength: 7, unit: fc.constantFrom(...'abcdefghijklmnop'.split('')) });

    fc.assert(
      fc.property(
        arbId(),
        arbSemanticTag(),
        arbCssValidId(),
        fc.constantFrom('width', 'color'),
        fc.constantFrom('100px', 'red'),
        (nodeId, tag, idAttr, prop, val) => {
          const obj: ObjetoHtml = {
            id: nodeId,
            tag,
            children: [],
            attributes: [['id', idAttr]],
          };
          const dir: Directriz = { selector: `#${idAttr}`, property: prop, value: val };
          const engine = new LayoutEngine(800, 600);

          const oldResult = engine.computeLayout([obj], [dir]);
          const oldDirs = getDirectivesForNode(oldResult, nodeId);

          const resolved = psdom.resolve([obj], [dir]);
          const newResult = engine.computeLayout([obj], [dir], resolved.directives);
          const newDirs = filterExplicitDirectives(getDirectivesForNode(newResult, nodeId));

          expect(newDirs.map(d => ({ s: d.selector, p: d.property, v: d.value })))
            .toEqual(oldDirs.map(d => ({ s: d.selector, p: d.property, v: d.value })));
        },
      ),
      { numRuns: 100 },
    );
  });
});
