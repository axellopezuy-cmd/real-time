import { ObjetoHtml, Directriz } from './types';

/**
 * Reconstructs real HTML from the ObjetoHtml tree.
 * This produces actual renderable HTML that the browser can display natively.
 */
export function reconstructHtml(objects: ObjetoHtml[]): string {
  return objects.map(obj => nodeToHtml(obj)).join('\n');
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function nodeToHtml(obj: ObjetoHtml): string {
  const attrs = obj.attributes
    .map(([key, val]) => val ? `${key}="${escapeAttr(val)}"` : key)
    .join(' ');

  const openTag = attrs ? `<${obj.tag} ${attrs}>` : `<${obj.tag}>`;

  if (VOID_ELEMENTS.has(obj.tag)) {
    return openTag;
  }

  const text = (obj as any).text_content || '';
  const children = obj.children.map(c => nodeToHtml(c)).join('\n');
  const content = text + children;

  return `${openTag}${content}</${obj.tag}>`;
}

function escapeAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Reconstructs real CSS from the Directriz array.
 * Groups directives by selector to produce clean CSS rules.
 */
export function reconstructCss(directives: Directriz[]): string {
  // Group by selector
  const groups = new Map<string, Map<string, string>>();

  for (const d of directives) {
    if (!groups.has(d.selector)) groups.set(d.selector, new Map());
    // Last value wins (mimics CSS cascade for same selector)
    groups.get(d.selector)!.set(d.property, d.value);
  }

  const rules: string[] = [];
  for (const [selector, props] of groups) {
    const declarations = Array.from(props.entries())
      .map(([prop, val]) => `  ${prop}: ${val};`)
      .join('\n');
    rules.push(`${selector} {\n${declarations}\n}`);
  }

  return rules.join('\n\n');
}
