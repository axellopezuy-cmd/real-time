import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  resolveInheritance,
  isInheritable,
  INHERITABLE_PROPERTIES,
  CSS_DEFAULTS,
} from '../psdom/inheritance';
import type { Directriz } from '../types';

// --- Generators ---

const arbInheritableProp = () =>
  fc.constantFrom(...Array.from(INHERITABLE_PROPERTIES));

const arbCssValue = () =>
  fc.constantFrom('red', 'blue', '16px', '20px', 'bold', 'italic', 'center', 'pointer', 'serif', 'normal');

const arbNodeId = () =>
  fc.string({ minLength: 2, maxLength: 6, unit: fc.constantFrom(...'abcdef0123456789'.split('')) });

// --- Property 6: Herencia — explícito > ancestro > default ---
// Feature: psdom, Property 6: Herencia — explícito > ancestro > default
// Validates: Requirements 3.1, 3.4
describe('Property 6: Herencia — explícito > ancestro > default', () => {
  it('valor explícito tiene prioridad sobre ancestro', () => {
    fc.assert(
      fc.property(
        arbInheritableProp(),
        arbCssValue(),
        arbCssValue(),
        (prop, explicitVal, ancestorVal) => {
          fc.pre(explicitVal !== ancestorVal);

          const nodeId = 'child';
          const parentId = 'parent';

          const resolvedMap = new Map<string, Directriz[]>();
          resolvedMap.set(nodeId, [{ selector: 'div', property: prop, value: explicitVal }]);
          resolvedMap.set(parentId, [{ selector: 'section', property: prop, value: ancestorVal }]);

          const result = resolveInheritance(nodeId, resolvedMap, [parentId]);
          const resolved = result.find(d => d.property === prop);

          expect(resolved).toBeDefined();
          expect(resolved!.value).toBe(explicitVal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('hereda del ancestro más cercano cuando no hay valor explícito', () => {
    fc.assert(
      fc.property(
        arbInheritableProp(),
        arbCssValue(),
        arbCssValue(),
        (prop, parentVal, grandparentVal) => {
          fc.pre(parentVal !== grandparentVal);

          const nodeId = 'child';
          const parentId = 'parent';
          const grandparentId = 'grandparent';

          const resolvedMap = new Map<string, Directriz[]>();
          resolvedMap.set(nodeId, []); // Sin valor explícito
          resolvedMap.set(parentId, [{ selector: 'div', property: prop, value: parentVal }]);
          resolvedMap.set(grandparentId, [{ selector: 'section', property: prop, value: grandparentVal }]);

          // ancestorChain: del más cercano al más lejano
          const result = resolveInheritance(nodeId, resolvedMap, [parentId, grandparentId]);
          const resolved = result.find(d => d.property === prop);

          expect(resolved).toBeDefined();
          expect(resolved!.value).toBe(parentVal); // Hereda del más cercano
        }
      ),
      { numRuns: 100 }
    );
  });

  it('usa default CSS cuando ningún ancestro tiene valor', () => {
    fc.assert(
      fc.property(arbInheritableProp(), (prop) => {
        const nodeId = 'child';
        const resolvedMap = new Map<string, Directriz[]>();
        resolvedMap.set(nodeId, []);

        const result = resolveInheritance(nodeId, resolvedMap, []);
        const resolved = result.find(d => d.property === prop);

        expect(resolved).toBeDefined();
        expect(resolved!.value).toBe(CSS_DEFAULTS[prop]);
        expect(resolved!.selector).toBe('default');
      }),
      { numRuns: 100 }
    );
  });

  it('propiedades no heredables no se propagan', () => {
    const nonInheritable = ['width', 'height', 'margin', 'padding', 'border', 'display'];
    for (const prop of nonInheritable) {
      expect(isInheritable(prop)).toBe(false);
    }
  });

  it('todas las propiedades heredables listadas están reconocidas', () => {
    const expected = [
      'color', 'font-family', 'font-size', 'font-weight', 'font-style',
      'line-height', 'text-align', 'visibility', 'cursor',
      'letter-spacing', 'word-spacing',
    ];
    for (const prop of expected) {
      expect(isInheritable(prop)).toBe(true);
    }
  });
});
