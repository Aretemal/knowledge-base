import { Component, Input, Output, EventEmitter } from '@angular/core';
import type { TreeFolder, FileItem } from '../../models';
import { TreeNodeComponent } from '../tree-node/tree-node.component';

@Component({
  selector: 'app-folder-tree',
  standalone: true,
  imports: [TreeNodeComponent],
  templateUrl: './folder-tree.component.html',
  styleUrl: './folder-tree.component.css',
})
export class FolderTreeComponent {
  @Input() tree: TreeFolder[] = [];
  @Input() filesByFolderId: Map<string, FileItem[]> = new Map();
  @Input() selectedId: string | null = null;
  @Input() expandedIds = new Set<string>();

  @Output() selectFolder = new EventEmitter<string | null>();
  @Output() renameFolder = new EventEmitter<{ id: string; name: string }>();
  @Output() deleteFolder = new EventEmitter<{ id: string; name: string }>();
  @Output() renameFile = new EventEmitter<FileItem>();
  @Output() deleteFile = new EventEmitter<FileItem>();
  @Output() openRoadmap = new EventEmitter<FileItem>();
  @Output() expandToggle = new EventEmitter<string>();

  getFilesFor(folderId: string): FileItem[] {
    return this.filesByFolderId.get(folderId) ?? [];
  }

  toggleExpand(id: string): void {
    this.expandToggle.emit(id);
  }
}
