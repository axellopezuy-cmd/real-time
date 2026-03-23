import { ObjetoHtml, Directriz, LayoutNode, Zone } from './types';

/**
 * LayoutEngine v2 — Mini browser layout.
 *
 * Computes layout using actual CSS-like rules:
 * - Normal flow: block elements stack vertically, take full parent width
 * - Flex layout: display:flex arranges children in a row (or column)
 * - CSS dimensions: width, height, padding, margin are respected
 * - No hardcoded zones — position is computed from document flow
 */

interface BoxModel {
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

const DEFAULT_TAG_HEIGHTS: Record<string, number> = {
  h1: 48,
  h2: 36,
  h3: 28,
  h4: 24,
  p: 20,
  a: 20,
  li: 20,
  span: 18,
  img: 150,
  ul: 0, // height comes from children
  ol: 0,
};

const INLINE_TAGS = new Set(['a', 'span', 'strong', 'em', 'b', 'i', 'code', 'small', 'label']);

export function getZoneForTag(tag: string): Zone {
  return 'center'; // v2: no zones, everything flows
}

export class LayoutEngine {
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  computeLayout(
    objects: ObjetoHtml[],
    directives: Directriz[],
    resolvedDirectives?: Map<string, Directriz[]>,
  ): LayoutNode[] {
    // Build all nodes first with their directives
    const nodes = objects.map(obj => this.buildNode(obj, resolvedDirectives));

    // Layout from top, full canvas width
    let y = 0;
    for (const node of nodes) {
      this.layoutBlock(node, 0, y, this.canvasWidth);
      y += this.outerHeight(node);
    }

    return nodes;
  }

  private buildNode(obj: ObjetoHtml, resolvedDirectives?: Map<string, Directriz[]>): LayoutNode {
    const dirs = resolvedDirectives?.get(obj.id) || [];
    const node: LayoutNode = {
      id: obj.id,
      tag: obj.tag,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      children: obj.children.map(c => this.buildNode(c, resolvedDirectives)),
      directives: dirs,
      zone: 'center',
      sourceFile: obj.source_file,
    };
    return node;
  }

  private layoutBlock(node: LayoutNode, parentX: number, parentY: number, availableWidth: number): void {
    const box = this.getBoxModel(node);
    const display = this.getDirectiveValue(node, 'display');
    const isHidden = display === 'none';

    if (isHidden) {
      node.hidden = true;
      node.width = 0;
      node.height = 0;
      return;
    }

    // Apply border-radius and opacity from directives
    const br = this.getDirectiveValue(node, 'border-radius');
    if (br) node.borderRadius = br;
    const op = this.getDirectiveValue(node, 'opacity');
    if (op) {
      const o = parseFloat(op);
      if (!isNaN(o)) node.opacity = Math.max(0, Math.min(1, o));
    }
    const fs = this.getDirectiveValue(node, 'font-size');
    if (fs) node.fontSize = fs;
    const tc = this.getDirectiveValue(node, 'color');
    if (tc) node.textColor = tc;

    // Compute width
    const cssWidth = this.parseDimension(this.getDirectiveValue(node, 'width'), availableWidth);
    const maxWidth = this.parseDimension(this.getDirectiveValue(node, 'max-width'), Infinity);

    let contentWidth: number;
    if (cssWidth !== null) {
      contentWidth = Math.min(cssWidth, maxWidth !== null ? maxWidth : Infinity);
    } else {
      contentWidth = availableWidth - box.marginLeft - box.marginRight;
      if (maxWidth !== null) contentWidth = Math.min(contentWidth, maxWidth);
    }

    node.width = contentWidth;
    node.x = parentX + box.marginLeft;
    node.y = parentY + box.marginTop;

    // Auto-center if width is less than available and has margin auto
    const marginVal = this.getDirectiveValue(node, 'margin') || '';
    const mlVal = this.getDirectiveValue(node, 'margin-left') || '';
    if (marginVal.includes('auto') || mlVal === 'auto' || marginVal === '0 auto' || marginVal === '0px auto') {
      const leftover = availableWidth - contentWidth;
      if (leftover > 0) {
        node.x = parentX + leftover / 2;
      }
    }

    // Layout children
    const innerX = node.x + box.paddingLeft;
    const innerWidth = node.width - box.paddingLeft - box.paddingRight;
    const innerStartY = node.y + box.paddingTop;

    if (display === 'flex' || display === 'inline-flex') {
      this.layoutFlex(node, innerX, innerStartY, innerWidth, box);
    } else {
      this.layoutNormalFlow(node, innerX, innerStartY, innerWidth);
    }

    // Compute height
    const cssHeight = this.parseDimension(this.getDirectiveValue(node, 'height'), null);
    const minHeight = this.parseDimension(this.getDirectiveValue(node, 'min-height'), 0) || 0;

    if (cssHeight !== null) {
      node.height = cssHeight;
    } else {
      // Height from children
      const childrenHeight = this.childrenTotalHeight(node, innerStartY);
      const intrinsicHeight = DEFAULT_TAG_HEIGHTS[node.tag] ?? 0;
      const contentH = Math.max(childrenHeight, intrinsicHeight);
      node.height = contentH + box.paddingTop + box.paddingBottom;
    }

    node.height = Math.max(node.height, minHeight);
  }

  private layoutNormalFlow(node: LayoutNode, innerX: number, innerStartY: number, innerWidth: number): void {
    let y = innerStartY;
    // Group inline elements on same line
    let inlineX = innerX;
    let inlineRowHeight = 0;

    for (const child of node.children) {
      const isInline = INLINE_TAGS.has(child.tag) || this.getDirectiveValue(child, 'display') === 'inline-block';

      if (isInline) {
        // Inline: place side by side
        const estWidth = this.estimateInlineWidth(child, innerWidth);
        if (inlineX + estWidth > innerX + innerWidth && inlineX > innerX) {
          // Wrap to next line
          y += inlineRowHeight;
          inlineX = innerX;
          inlineRowHeight = 0;
        }
        this.layoutBlock(child, inlineX, y, estWidth);
        inlineX += this.outerWidth(child);
        inlineRowHeight = Math.max(inlineRowHeight, this.outerHeight(child));
      } else {
        // Block: flush inline row first
        if (inlineX > innerX) {
          y += inlineRowHeight;
          inlineX = innerX;
          inlineRowHeight = 0;
        }
        this.layoutBlock(child, innerX, y, innerWidth);
        y += this.outerHeight(child);
      }
    }
  }

  private layoutFlex(node: LayoutNode, innerX: number, innerStartY: number, innerWidth: number, box: BoxModel): void {
    const direction = this.getDirectiveValue(node, 'flex-direction') || 'row';
    const gap = this.parseDimension(this.getDirectiveValue(node, 'gap'), 0) || 0;
    const flexWrap = this.getDirectiveValue(node, 'flex-wrap');
    const justifyContent = this.getDirectiveValue(node, 'justify-content') || 'flex-start';
    const alignItems = this.getDirectiveValue(node, 'align-items') || 'stretch';

    const visibleChildren = node.children.filter(c => this.getDirectiveValue(c, 'display') !== 'none');

    if (direction === 'column') {
      // Column flex: stack vertically (like normal flow but with gap)
      let y = innerStartY;
      for (const child of visibleChildren) {
        this.layoutBlock(child, innerX, y, innerWidth);
        y += this.outerHeight(child) + gap;
      }
    } else {
      // Row flex: distribute horizontally
      const totalGap = gap * Math.max(0, visibleChildren.length - 1);
      const availForChildren = innerWidth - totalGap;

      // First pass: compute child widths
      const childWidths: number[] = [];
      let totalExplicit = 0;
      let flexCount = 0;

      for (const child of visibleChildren) {
        const cw = this.parseDimension(this.getDirectiveValue(child, 'width'), null);
        if (cw !== null) {
          childWidths.push(cw);
          totalExplicit += cw;
        } else {
          childWidths.push(-1); // needs flex
          flexCount++;
        }
      }

      const flexShare = flexCount > 0 ? (availForChildren - totalExplicit) / flexCount : 0;
      for (let i = 0; i < childWidths.length; i++) {
        if (childWidths[i] < 0) childWidths[i] = Math.max(0, flexShare);
      }

      // Justify content
      let x = innerX;
      const totalChildWidth = childWidths.reduce((a, b) => a + b, 0) + totalGap;
      const freeSpace = innerWidth - totalChildWidth;

      if (justifyContent === 'center') {
        x += freeSpace / 2;
      } else if (justifyContent === 'flex-end' || justifyContent === 'end') {
        x += freeSpace;
      } else if (justifyContent === 'space-between' && visibleChildren.length > 1) {
        // gap becomes distributed
        const spaceBetween = freeSpace / (visibleChildren.length - 1);
        let cx = innerX;
        for (let i = 0; i < visibleChildren.length; i++) {
          this.layoutBlock(visibleChildren[i], cx, innerStartY, childWidths[i]);
          cx += childWidths[i] + spaceBetween;
        }
        return;
      } else if (justifyContent === 'space-around' && visibleChildren.length > 0) {
        const spaceAround = freeSpace / (visibleChildren.length * 2);
        let cx = innerX + spaceAround;
        for (let i = 0; i < visibleChildren.length; i++) {
          this.layoutBlock(visibleChildren[i], cx, innerStartY, childWidths[i]);
          cx += childWidths[i] + spaceAround * 2;
        }
        return;
      }

      // Default: flex-start or center or flex-end
      for (let i = 0; i < visibleChildren.length; i++) {
        this.layoutBlock(visibleChildren[i], x, innerStartY, childWidths[i]);
        x += childWidths[i] + gap;
      }

      // Align items: adjust vertical position after layout
      if (alignItems === 'center') {
        const maxH = Math.max(...visibleChildren.map(c => this.outerHeight(c)), 0);
        for (const child of visibleChildren) {
          const diff = maxH - this.outerHeight(child);
          if (diff > 0) child.y += diff / 2;
        }
      }
    }
  }

  private getDirectiveValue(node: LayoutNode, property: string): string | null {
    const dir = node.directives.find(d => d.property === property);
    return dir ? dir.value.trim() : null;
  }

  private getBoxModel(node: LayoutNode): BoxModel {
    const result: BoxModel = {
      marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
      paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
    };

    // Parse margin shorthand
    const margin = this.getDirectiveValue(node, 'margin');
    if (margin && !margin.includes('auto')) {
      const parts = margin.split(/\s+/).map(p => this.parsePx(p));
      if (parts.length === 1) {
        result.marginTop = result.marginRight = result.marginBottom = result.marginLeft = parts[0];
      } else if (parts.length === 2) {
        result.marginTop = result.marginBottom = parts[0];
        result.marginRight = result.marginLeft = parts[1];
      } else if (parts.length === 4) {
        [result.marginTop, result.marginRight, result.marginBottom, result.marginLeft] = parts;
      }
    }

    // Individual margins override shorthand
    const mt = this.getDirectiveValue(node, 'margin-top');
    if (mt) result.marginTop = this.parsePx(mt);
    const mr = this.getDirectiveValue(node, 'margin-right');
    if (mr) result.marginRight = this.parsePx(mr);
    const mb = this.getDirectiveValue(node, 'margin-bottom');
    if (mb) result.marginBottom = this.parsePx(mb);
    const ml = this.getDirectiveValue(node, 'margin-left');
    if (ml && ml !== 'auto') result.marginLeft = this.parsePx(ml);

    // Parse padding shorthand
    const padding = this.getDirectiveValue(node, 'padding');
    if (padding) {
      const parts = padding.split(/\s+/).map(p => this.parsePx(p));
      if (parts.length === 1) {
        result.paddingTop = result.paddingRight = result.paddingBottom = result.paddingLeft = parts[0];
      } else if (parts.length === 2) {
        result.paddingTop = result.paddingBottom = parts[0];
        result.paddingRight = result.paddingLeft = parts[1];
      } else if (parts.length === 4) {
        [result.paddingTop, result.paddingRight, result.paddingBottom, result.paddingLeft] = parts;
      }
    }

    const pt = this.getDirectiveValue(node, 'padding-top');
    if (pt) result.paddingTop = this.parsePx(pt);
    const pr = this.getDirectiveValue(node, 'padding-right');
    if (pr) result.paddingRight = this.parsePx(pr);
    const pb = this.getDirectiveValue(node, 'padding-bottom');
    if (pb) result.paddingBottom = this.parsePx(pb);
    const pl = this.getDirectiveValue(node, 'padding-left');
    if (pl) result.paddingLeft = this.parsePx(pl);

    return result;
  }

  private parsePx(val: string): number {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }

  private parseDimension(val: string | null, fallback: number | null): number | null {
    if (!val) return fallback;
    if (val.endsWith('%')) {
      const n = parseFloat(val);
      return isNaN(n) ? fallback : (n / 100) * this.canvasWidth;
    }
    const n = parseFloat(val);
    return isNaN(n) ? fallback : n;
  }

  private estimateInlineWidth(child: LayoutNode, maxWidth: number): number {
    const cw = this.parseDimension(this.getDirectiveValue(child, 'width'), null);
    if (cw !== null) return cw;
    return Math.min(120, maxWidth / 3);
  }

  private outerHeight(node: LayoutNode): number {
    if (node.hidden) return 0;
    const box = this.getBoxModel(node);
    return node.height + box.marginTop + box.marginBottom;
  }

  private outerWidth(node: LayoutNode): number {
    if (node.hidden) return 0;
    const box = this.getBoxModel(node);
    return node.width + box.marginLeft + box.marginRight;
  }

  private childrenTotalHeight(node: LayoutNode, startY: number): number {
    if (node.children.length === 0) return 0;
    let maxBottom = startY;
    for (const child of node.children) {
      if (child.hidden) continue;
      const childBottom = child.y + child.height + (this.getBoxModel(child).marginBottom);
      maxBottom = Math.max(maxBottom, childBottom);
    }
    return maxBottom - startY;
  }
}
