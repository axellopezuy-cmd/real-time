import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../layout-engine';
import { applyDirectives } from '../directive-applicator';
import { BoxRenderer } from '../box-renderer';
import type { ObjetoHtml, Directriz, RenderMessage } from '../types';

// Integration tests: full flow from RenderMessage → Layout → Render
// Validates: Requirements 1.4, 3.2, 5.4

describe('Integration: Full rendering pipeline', () => {
  it('renders a complete HTML+CSS example', () => {
    const msg: RenderMessage = {
      objects: [
        { id: '1', tag: 'header', children: [], attributes: [] },
        { id: '2', tag: 'nav', children: [], attributes: [] },
        {
          id: '3', tag: 'section', children: [
            { id: '4', tag: 'div', children: [], attributes: [['class', 'card']] },
          ], attributes: [],
        },
        { id: '5', tag: 'footer', children: [], attributes: [] },
      ],
      directives: [
        { selector: 'header', property: 'height', value: '80px' },
        { selector: '.card', property: 'width', value: '200px' },
        { selector: 'footer', property: 'height', value: '50px' },
      ],
      timestamp: Date.now(),
    };

    const engine = new LayoutEngine(800, 600);
    const layout = engine.computeLayout(msg.objects, msg.directives);
    const withDirectives = applyDirectives(layout);
    const renderer = new BoxRenderer();
    const commands = renderer.render(withDirectives);

    // Should produce render commands for all 5 objects
    const rects = commands.filter(c => c.type === 'rect');
    expect(rects.length).toBe(5);

    // Should have text labels for all objects
    const texts = commands.filter(c => c.type === 'text');
    expect(texts.length).toBe(5);

    // Header should be in top zone
    const headerNode = withDirectives.find(n => n.id === '1');
    expect(headerNode?.zone).toBe('top');

    // Footer should be in bottom zone
    const footerNode = withDirectives.find(n => n.id === '5');
    expect(footerNode?.zone).toBe('bottom');
  });

  it('handles empty input gracefully (error tolerance)', () => {
    const msg: RenderMessage = {
      objects: [],
      directives: [],
      timestamp: Date.now(),
    };

    const engine = new LayoutEngine(800, 600);
    const layout = engine.computeLayout(msg.objects, msg.directives);
    const withDirectives = applyDirectives(layout);
    const renderer = new BoxRenderer();
    const commands = renderer.render(withDirectives);

    expect(commands).toEqual([]);
  });

  it('handles directives with no matching objects', () => {
    const msg: RenderMessage = {
      objects: [
        { id: '1', tag: 'div', children: [], attributes: [] },
      ],
      directives: [
        { selector: '.nonexistent', property: 'width', value: '100px' },
      ],
      timestamp: Date.now(),
    };

    const engine = new LayoutEngine(800, 600);
    const layout = engine.computeLayout(msg.objects, msg.directives);
    const withDirectives = applyDirectives(layout);
    const renderer = new BoxRenderer();
    const commands = renderer.render(withDirectives);

    // Should still render the div, just without the directive applied
    const rects = commands.filter(c => c.type === 'rect');
    expect(rects.length).toBe(1);
  });

  it('stateless: re-rendering after changes produces clean state', () => {
    const engine = new LayoutEngine(800, 600);
    const renderer = new BoxRenderer();

    // First render with styles
    const msg1: RenderMessage = {
      objects: [{ id: '1', tag: 'div', children: [], attributes: [] }],
      directives: [{ selector: 'div', property: 'width', value: '300px' }],
      timestamp: 1,
    };
    const r1 = applyDirectives(engine.computeLayout(msg1.objects, msg1.directives));

    // Second render without styles (simulating CSS removal)
    const msg2: RenderMessage = {
      objects: [{ id: '1', tag: 'div', children: [], attributes: [] }],
      directives: [],
      timestamp: 2,
    };
    const r2 = applyDirectives(engine.computeLayout(msg2.objects, msg2.directives));

    // The div should revert to default width (no directive influence)
    const node1 = r1.find(n => n.id === '1')!;
    const node2 = r2.find(n => n.id === '1')!;
    expect(node1.width).toBe(300); // directive applied
    expect(node2.width).not.toBe(300); // reverted to default
  });
});
