import { LayoutNode } from './types';

export interface RenderCommand {
  type: 'rect' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  strokeColor?: string;
  fillColor?: string;
  borderRadius?: number;
  opacity?: number;
  borderWidth?: number;
  fontSize?: string;
  textColor?: string;
  borderStyle?: string;
}

/**
 * BoxRenderer v2 — Renders LayoutNodes as visual boxes on canvas.
 *
 * Key changes from v1:
 * - Background color comes from CSS directives, not from zone
 * - Border color/width from CSS
 * - Tag labels are subtle, not dominant
 * - Respects actual computed dimensions from layout engine
 */
export class BoxRenderer {
  render(nodes: LayoutNode[]): RenderCommand[] {
    const commands: RenderCommand[] = [];
    for (const node of nodes) {
      if (!node.hidden) this.renderNode(node, commands, 0);
    }
    return commands;
  }

  private renderNode(node: LayoutNode, commands: RenderCommand[], depth: number): void {
    if (node.hidden || node.width <= 0 || node.height <= 0) return;

    const fillColor = this.resolveBgColor(node, depth);
    const borderRadius = node.borderRadius ? parseFloat(node.borderRadius) || 0 : 0;
    const opacity = node.opacity ?? 1;
    const borderInfo = this.resolveBorder(node);

    commands.push({
      type: 'rect',
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      strokeColor: borderInfo.color,
      fillColor,
      borderRadius,
      opacity,
      borderWidth: borderInfo.width,
      borderStyle: borderInfo.style,
    });

    // Tag label — small, top-left corner
    const fontSize = '10px';
    const textColor = this.getLabelColor(fillColor);
    commands.push({
      type: 'text',
      x: node.x + 3,
      y: node.y + 11,
      label: `<${node.tag}>`,
      fontSize,
      textColor,
    });

    // Render children
    for (const child of node.children) {
      if (!child.hidden) this.renderNode(child, commands, depth + 1);
    }
  }

  private resolveBgColor(node: LayoutNode, depth: number): string {
    // Check for background-color directive
    const bgDir = node.directives.find(d => d.property === 'background-color');
    if (bgDir) return bgDir.value.trim();

    // Check background shorthand (take first color-like value)
    const bgShort = node.directives.find(d => d.property === 'background');
    if (bgShort) {
      const val = bgShort.value.trim();
      // Extract color from background shorthand
      const colorMatch = val.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/);
      if (colorMatch) return colorMatch[0];
    }

    // Default: subtle depth-based tint so structure is visible
    const alpha = Math.max(0.03, 0.08 - depth * 0.015);
    return `rgba(100, 140, 200, ${alpha})`;
  }

  private resolveBorder(node: LayoutNode): { color: string; width: number; style: string } {
    const borderDir = node.directives.find(d => d.property === 'border');
    if (borderDir) {
      const parts = borderDir.value.trim().split(/\s+/);
      return {
        width: parseFloat(parts[0]) || 1,
        style: parts[1] || 'solid',
        color: parts[2] || '#555',
      };
    }

    // Check for conflict marker
    const hasConflict = node.directives.some(d => d.selector === '__conflict__');
    if (hasConflict) return { color: '#e53935', width: 2, style: 'dashed' };

    return { color: 'rgba(120,120,120,0.3)', width: 0.5, style: 'solid' };
  }

  private getLabelColor(bgColor: string): string {
    // If background is dark, use light label; otherwise dark
    if (bgColor.startsWith('#')) {
      const hex = bgColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      const luminance = (r * 299 + g * 587 + b * 114) / 1000;
      return luminance < 128 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
    }
    return 'rgba(0,0,0,0.4)';
  }

  renderToCanvas(ctx: CanvasRenderingContext2D, nodes: LayoutNode[]): void {
    const commands = this.render(nodes);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const cmd of commands) {
      if (cmd.type === 'rect') {
        const savedAlpha = ctx.globalAlpha;
        ctx.globalAlpha = cmd.opacity ?? 1;

        const x = cmd.x, y = cmd.y, w = cmd.width ?? 0, h = cmd.height ?? 0;
        const r = Math.min(cmd.borderRadius ?? 0, w / 2, h / 2);

        ctx.fillStyle = cmd.fillColor ?? 'transparent';
        if (r > 0) {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }

        if ((cmd.borderWidth ?? 0) > 0) {
          ctx.strokeStyle = cmd.strokeColor ?? '#333';
          ctx.lineWidth = cmd.borderWidth ?? 1;
          if (cmd.borderStyle === 'dashed') {
            ctx.setLineDash([4, 3]);
          } else {
            ctx.setLineDash([]);
          }
          if (r > 0) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
            ctx.stroke();
          } else {
            ctx.strokeRect(x, y, w, h);
          }
          ctx.setLineDash([]);
        }

        ctx.globalAlpha = savedAlpha;
      } else if (cmd.type === 'text') {
        const size = cmd.fontSize || '12px';
        ctx.fillStyle = cmd.textColor || '#333';
        ctx.font = `${size} monospace`;
        ctx.fillText(cmd.label ?? '', cmd.x, cmd.y);
      }
    }
  }
}
