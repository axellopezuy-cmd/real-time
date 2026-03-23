export interface ObjetoHtml {
  id: string;
  tag: string;
  children: ObjetoHtml[];
  attributes: [string, string][];
  source_file?: string;
  text_content?: string;
}

export interface Directriz {
  selector: string;
  property: string;
  value: string;
  source_file?: string;
}

export interface RenderMessage {
  objects: ObjetoHtml[];
  directives: Directriz[];
  timestamp: number;
}

export type Zone = 'top' | 'center' | 'bottom' | 'background';

export interface LayoutNode {
  id: string;
  tag: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
  directives: Directriz[];
  zone: Zone;
  sourceFile?: string;
  hidden?: boolean;
  borderRadius?: string;
  opacity?: number;
  fontSize?: string;
  textColor?: string;
}
