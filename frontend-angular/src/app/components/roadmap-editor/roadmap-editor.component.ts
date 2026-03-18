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

  mode: 'view' | 'edit' = 'view';
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
    this.mode = 'view';
    this.title = this.data?.title ?? '';
    this.nodes = [...(this.data?.nodes ?? [])];
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

  onSave(): void {
    this.error = null;
    const payload: RoadmapData = { title: this.title, nodes: this.nodes };
    this.save.emit(payload);
  }
}
