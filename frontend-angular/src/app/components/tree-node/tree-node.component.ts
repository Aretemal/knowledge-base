import { Component, Input, Output, EventEmitter } from '@angular/core';
import type { TreeFolder, FileItem } from '../../models';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [TreeNodeComponent],
  templateUrl: './tree-node.component.html',
  styleUrl: './tree-node.component.css',
})
export class TreeNodeComponent {
  @Input({ required: true }) node!: TreeFolder;
  @Input() depth = 0;
  @Input() filesInFolder: FileItem[] = [];
  @Input() filesByFolderId: Map<string, FileItem[]> = new Map();
  @Input() selectedId: string | null = null;
  @Input() expandedIds = new Set<string>();

  constructor(private api: ApiService) {}

  getFilesFor(folderId: string): FileItem[] {
    return this.filesByFolderId.get(folderId) ?? [];
  }

  getDownloadUrl(fileId: string): string {
    return this.api.getFileDownloadUrl(fileId);
  }

  @Output() selectFolder = new EventEmitter<string | null>();
  @Output() renameFolder = new EventEmitter<{ id: string; name: string }>();
  @Output() deleteFolder = new EventEmitter<{ id: string; name: string }>();
  @Output() renameFile = new EventEmitter<FileItem>();
  @Output() deleteFile = new EventEmitter<FileItem>();
  @Output() openRoadmap = new EventEmitter<FileItem>();
  @Output() toggleExpand = new EventEmitter<string>();

  get hasChildren(): boolean {
    return this.node.children.length > 0 || this.filesInFolder.length > 0;
  }

  get isExpanded(): boolean {
    return this.expandedIds.has(this.node.id);
  }

  get isSelected(): boolean {
    return this.selectedId === this.node.id;
  }

  onSelect(): void {
    this.selectFolder.emit(this.node.id);
  }

  onToggle(e: Event): void {
    e.stopPropagation();
    if (this.hasChildren) this.toggleExpand.emit(this.node.id);
  }

  isRoadmap(file: FileItem): boolean {
    return file.name.toLowerCase().endsWith('.roadmap');
  }
}
