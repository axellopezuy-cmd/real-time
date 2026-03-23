import { LayoutNode } from './types';

/**
 * DirectiveApplicator v2 — Minimal post-processing.
 *
 * The LayoutEngine now handles all positioning and sizing from directives.
 * This module only filters hidden nodes (display:none already handled by layout).
 */
export function applyDirectives(nodes: LayoutNode[]): LayoutNode[] {
  return nodes.filter(n => !n.hidden);
}
