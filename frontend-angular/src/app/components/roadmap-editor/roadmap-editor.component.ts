import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
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

  get mainNodes(): RoadmapNode[] {
    return this.nodes
      .filter((n) => n.type === 'main')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  getBranches(parentId: string): RoadmapNode[] {
    return this.nodes.filter((n) => n.type === 'branch' && n.parentId === parentId);
  }

  ngOnInit(): void {
    this.title = this.data.title;
    this.nodes = [...this.data.nodes];
  }

  private genId(): string {
    return 'n-' + Math.random().toString(36).slice(2, 10);
  }

  addMainNode(): void {
    const label = window.prompt('Название узла основной дороги:');
    if (!label) return;
    const order = this.mainNodes.length;
    this.nodes = [...this.nodes, { id: this.genId(), label, type: 'main', order }];
  }

  addBranch(parentId: string): void {
    const label = window.prompt('Название ответвления:');
    if (!label) return;
    this.nodes = [...this.nodes, { id: this.genId(), label, type: 'branch', parentId }];
  }

  addSubBranch(parentId: string): void {
    const label = window.prompt('Название подузла:');
    if (!label) return;
    this.nodes = [...this.nodes, { id: this.genId(), label, type: 'branch', parentId }];
  }

  updateNodeContent(id: string, content: string): void {
    this.nodes = this.nodes.map((n) => (n.id === id ? { ...n, content } : n));
  }

  editingNode: RoadmapNode | null = null;
  editingContent = '';

  openNodeModal(node: RoadmapNode): void {
    this.editingNode = node;
    this.editingContent = node.content ?? '';
  }

  closeNodeModal(): void {
    this.editingNode = null;
  }

  saveNodeContent(): void {
    if (!this.editingNode) return;
    this.updateNodeContent(this.editingNode.id, this.editingContent);
    this.editingNode = null;
  }

  onSave(): void {
    this.error = null;
    const payload: RoadmapData = { title: this.title, nodes: this.nodes };
    this.save.emit(payload);
  }
}
