import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateSpecificity,
  compareSpecificity,
  resolveBySpecificity,
  type Specificity,
} from '../psdom/specificity';
import type { Directriz } from '../types';

// --- Generators ---

/** Genera un nombre de tag HTML válido */
const arbTag = () => fc.constantFrom('div', 'p', 'span', 'ul', 'li', 'h1', 'h2', 'section', 'header', 'nav', 'a');

/** Genera un nombre de clase válido */
const arbClass = () => fc.constantFrom('main', 'active', 'hidden', 'container', 'wrapper', 'item');

/** Genera un nombre de ID válido */
const arbId = () => fc.constantFrom('app', 'root', 'content', 'sidebar', 'header', 'nav');

/** Genera un selector con cantidades conocidas de IDs, clases y elementos */
const arbSelectorWithKnownSpecificity = () =>
  fc.record({
    ids: fc.integer({ min: 0, max: 3 }),
    classes: fc.integer({ min: 0, max: 4 }),
    elements: fc.integer({ min: 0, max: 3 }),
  }).chain(({ ids, classes, elements }) => {
    const idParts = Array.from({ length: ids }, (_, i) => `#id${i}`);
    const classParts = Array.from({ length: classes }, (_, i) => `.cls${i}`);
    const elemParts = Array.from({ length: elements }, (_, i) => `el${i}`);
    // Construir selector combinando partes con espacios (descendant combinator)
    const parts = [...elemParts, ...classParts, ...idParts].filter(Boolean);
    const selector = parts.length > 0 ? parts.join(' ') : 'div';
    const expectedIds = ids;
    const expectedClasses = classes;
    const expectedElements = elements > 0 ? elements : (parts.length === 0 ? 1 : 0);
    return fc.constant({
      selector,
      expected: [expectedIds, expectedClasses, expectedElements] as Specificity,
    });
  });

// --- Property 4: Especificidad matemática correcta ---
// Feature: psdom, Property 4: Especificidad matemática correcta
// Validates: Requirements 2.1
describe('Property 4: Especificidad matemática correcta', () => {
  it('calcula tupla (a, b, c) correcta para selectores con cantidades conocidas', () => {
    fc.assert(
      fc.property(arbSelectorWithKnownSpecificity(), ({ selector, expected }) => {
        const result = calculateSpecificity(selector);
        expect(result).toEqual(expected);
      }),
      { numRuns: 100 }
    );
  });

  // Unit tests para casos específicos conocidos
  it('#id = (1,0,0)', () => {
    expect(calculateSpecificity('#app')).toEqual([1, 0, 0]);
  });

  it('.class = (0,1,0)', () => {
    expect(calculateSpecificity('.main')).toEqual([0, 1, 0]);
  });

  it('div = (0,0,1)', () => {
    expect(calculateSpecificity('div')).toEqual([0, 0, 1]);
  });

  it('#id .class div = (1,1,1)', () => {
    expect(calculateSpecificity('#id .class div')).toEqual([1, 1, 1]);
  });

  it('div > p = (0,0,2)', () => {
    expect(calculateSpecificity('div > p')).toEqual([0, 0, 2]);
  });

  it('[href] = (0,1,0)', () => {
    expect(calculateSpecificity('[href]')).toEqual([0, 1, 0]);
  });

  it(':hover = (0,1,0)', () => {
    expect(calculateSpecificity(':hover')).toEqual([0, 1, 0]);
  });

  it('::before = (0,0,1)', () => {
    expect(calculateSpecificity('::before')).toEqual([0, 0, 1]);
  });

  it(':not(.hidden) = (0,1,0) — :not no cuenta, su contenido sí', () => {
    expect(calculateSpecificity(':not(.hidden)')).toEqual([0, 1, 0]);
  });

  it('div:nth-child(2) = (0,1,1)', () => {
    expect(calculateSpecificity('div:nth-child(2)')).toEqual([0, 1, 1]);
  });
});

// --- Property 5: Cascada — mayor especificidad o última declaración gana ---
// Feature: psdom, Property 5: Cascada — mayor especificidad o última declaración gana
// Validates: Requirements 2.2, 2.3, 5.3
describe('Property 5: Cascada — mayor especificidad o última declaración gana', () => {
  it('mayor especificidad siempre gana', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('#id', '.class', 'div'),
        fc.constantFrom('#id', '.class', 'div'),
        fc.constantFrom('red', 'blue', 'green'),
        fc.constantFrom('red', 'blue', 'green'),
        (sel1, sel2, val1, val2) => {
          const spec1 = calculateSpecificity(sel1);
          const spec2 = calculateSpecificity(sel2);
          const cmp = compareSpecificity(spec1, spec2);
          fc.pre(cmp !== 0); // Solo cuando especificidades son distintas

          const d1: Directriz = { selector: sel1, property: 'color', value: val1 };
          const d2: Directriz = { selector: sel2, property: 'color', value: val2 };
          const winner = resolveBySpecificity([d1, d2]);

          if (cmp > 0) {
            expect(winner.selector).toBe(sel1);
          } else {
            expect(winner.selector).toBe(sel2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('en empate de especificidad, la última declaración gana', () => {
    fc.assert(
      fc.property(
        arbTag(),
        arbTag(),
        fc.constantFrom('red', 'blue', 'green'),
        fc.constantFrom('red', 'blue', 'green'),
        (tag1, tag2, val1, val2) => {
          // Ambos son selectores de elemento → misma especificidad (0,0,1)
          const d1: Directriz = { selector: tag1, property: 'color', value: val1 };
          const d2: Directriz = { selector: tag2, property: 'color', value: val2 };
          const winner = resolveBySpecificity([d1, d2]);
          // La última (d2) debe ganar en empate
          expect(winner).toBe(d2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
