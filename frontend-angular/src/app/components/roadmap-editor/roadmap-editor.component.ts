import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FileItem, RoadmapData, RoadmapNode } from '../../models';

@Component({
  selector: 'app-roadmap-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './roadmap-editor.component.html',
  styleUrl: './roadmap-editor.component.css',
})
export class RoadmapEditorComponent implements OnInit {
  @Input({ required: true }) file!: FileItem;
  @Input({ required: true }) data!: RoadmapData;
  @Input() saving = false;

  @Output() save = new EventEmitter<RoadmapData>();
  @Output() close = new EventEmitter<void>();

  title = '';
  nodes: RoadmapNode[] = [];
  error: string | null = null;

  private baseline = '';

  selectedNodeId: string | null = null;
  selectedLabel = '';
  selectedContent = '';

  creatingOpen = false;
  creatingType: RoadmapNode['type'] = 'main';
  creatingParentId: string | null = null;
  creatingLabel = '';
  creatingContent = '';

  get mainNodes(): RoadmapNode[] {
    return this.nodes
      .filter((n) => n.type === 'main')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  getBranches(parentId: string): RoadmapNode[] {
    return this.nodes.filter((n) => n.type === 'branch' && n.parentId === parentId);
  }

  get isDirty(): boolean {
    return this.baseline !== this.serialize();
  }

  get selectedNode(): RoadmapNode | null {
    if (!this.selectedNodeId) return null;
    return this.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  ngOnInit(): void {
    this.resetFromInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.resetFromInputs();
    }
  }

  private resetFromInputs(): void {
    this.title = this.data?.title ?? '';
    // Strip color so user/custom values can't persist.
    this.nodes = (this.data?.nodes ?? []).map((n) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { color: _color, ...rest } = n as RoadmapNode & { color?: string };
      return rest as RoadmapNode;
    });
    this.clearSelection();
    this.baseline = this.serialize();
  }

  private serialize(): string {
    return JSON.stringify({ title: this.title, nodes: this.nodes });
  }

  private genId(): string {
    return 'n-' + Math.random().toString(36).slice(2, 10);
  }

  openCreateNodeModal(type: RoadmapNode['type'], parentId: string | null = null): void {
    this.creatingOpen = true;
    this.creatingType = type;
    this.creatingParentId = parentId;
    this.creatingLabel = '';
    this.creatingContent = '';
  }

  closeCreateNodeModal(): void {
    this.creatingOpen = false;
  }

  createNode(): void {
    const label = this.creatingLabel.trim();
    const content = this.creatingContent.trim();
    if (!label) return;

    const base: RoadmapNode = {
      id: this.genId(),
      label,
      type: this.creatingType,
      ...(content ? { content } : {}),
    };

    let node: RoadmapNode;
    if (this.creatingType === 'main') {
      const order = this.mainNodes.length;
      node = { ...base, order };
    } else {
      node = { ...base, parentId: this.creatingParentId ?? undefined };
    }

    this.nodes = [...this.nodes, node];
    this.selectNode(node.id);
    this.creatingOpen = false;
  }

  updateNodeContent(id: string, content: string): void {
    const trimmed = content.trim();
    this.nodes = this.nodes.map((n) => (n.id === id ? { ...n, content: trimmed ? content : undefined } : n));
  }

  updateNodeLabel(id: string, label: string): void {
    this.nodes = this.nodes.map((n) => (n.id === id ? { ...n, label } : n));
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId = nodeId;
    const node = this.nodes.find((n) => n.id === nodeId);
    this.selectedLabel = node?.label ?? '';
    this.selectedContent = node?.content ?? '';
  }

  clearSelection(): void {
    this.selectedNodeId = null;
    this.selectedLabel = '';
    this.selectedContent = '';
  }

  openCreateChildFromDrawer(): void {
    if (!this.selectedNodeId) return;
    const parentId = this.selectedNodeId;
    // Close drawer first, then open creation modal.
    this.clearSelection();
    this.openCreateNodeModal('branch', parentId);
  }

  updateSelectedLabel(next: string): void {
    if (!this.selectedNodeId) return;
    this.selectedLabel = next;
    this.nodes = this.nodes.map((n) => (n.id === this.selectedNodeId ? { ...n, label: next } : n));
  }

  updateSelectedContent(next: string): void {
    if (!this.selectedNodeId) return;
    this.selectedContent = next;
    const trimmed = next.trim();
    this.nodes = this.nodes.map((n) =>
      n.id === this.selectedNodeId ? { ...n, content: trimmed ? next : undefined } : n,
    );
  }

  getNodeColor(node: RoadmapNode): string {
    return this.getDefaultColorForNode(node);
  }

  getTileTextColor(color: string): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return '#111111';
    // Relative luminance (sRGB) for contrast
    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return luminance > 0.6 ? '#111111' : '#FFFFFF';
  }

  private getDefaultColorForNode(node: RoadmapNode): string {
    if (node.type === 'main') return '#F6C445'; // yellow

    // branch nodes: depth depends on parent
    if (node.parentId) {
      const parent = this.nodes.find((n) => n.id === node.parentId);
      if (parent?.type === 'main') return '#33C46B'; // green (level 1 branch)
      return '#3498DB'; // blue (level 2 sub)
    }

    return '#33C46B';
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const value = hex.trim().toLowerCase();
    const match = value.match(/^#([0-9a-f]{6})$/i);
    if (!match) return null;
    const intVal = parseInt(match[1], 16);
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255,
    };
  }

  deleteNode(nodeId: string): void {
    // Delete node + all descendant nodes by following parentId links.
    const childrenByParent = new Map<string, RoadmapNode[]>();
    for (const n of this.nodes) {
      if (!n.parentId) continue;
      const list = childrenByParent.get(n.parentId) ?? [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    }

    const toDelete = new Set<string>();
    const stack: string[] = [nodeId];
    while (stack.length) {
      const current = stack.pop()!;
      if (toDelete.has(current)) continue;
      toDelete.add(current);
      const children = childrenByParent.get(current) ?? [];
      for (const c of children) stack.push(c.id);
    }

    this.nodes = this.nodes.filter((n) => !toDelete.has(n.id));
    this.clearSelection();
  }

  deleteSelectedNode(): void {
    if (!this.selectedNodeId) return;
    const ok = confirm('Удалить узел и все его ответвления?');
    if (!ok) return;
    this.deleteNode(this.selectedNodeId);
  }

  onSave(): void {
    this.error = null;
    const payloadNodes: RoadmapNode[] = this.nodes.map((n) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { color: _color, ...rest } = n as RoadmapNode & { color?: string };
      return rest as RoadmapNode;
    });
    const payload: RoadmapData = { title: this.title, nodes: payloadNodes };
    this.save.emit(payload);
    // If the parent doesn't immediately unmount the component, keep the button state consistent.
    this.baseline = this.serialize();
  }
}
