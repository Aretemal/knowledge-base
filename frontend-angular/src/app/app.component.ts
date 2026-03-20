import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import type { Folder, FileItem, TreeFolder, RoadmapData } from './models';
import { ApiService } from './services/api.service';
import { FolderTreeComponent } from './components/folder-tree/folder-tree.component';
import { RoadmapEditorComponent } from './components/roadmap-editor/roadmap-editor.component';
import {
  PromptDialogComponent,
  type PromptDialogData,
} from './dialogs/prompt-dialog.component';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
} from './dialogs/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FolderTreeComponent, RoadmapEditorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  loading = false;
  error: string | null = null;
  folderTree: TreeFolder[] = [];
  filesByFolderId = new Map<string, FileItem[]>();
  currentFolderId: string | null = null;
  currentFolderPath: Folder[] = [];
  childFolders: Folder[] = [];
  files: FileItem[] = [];
  expandedIds = new Set<string>();

  editingRoadmapFile: FileItem | null = null;
  roadmapData: RoadmapData | null = null;
  roadmapSaving = false;
  dropZoneActive = false;

  ngOnInit(): void {
    this.loadTree().then(() => this.selectFolder(null));
  }

  private async prompt(options: PromptDialogData): Promise<string | null> {
    const ref = this.dialog.open(PromptDialogComponent, {
      data: options,
      width: '360px',
    });
    return ref.afterClosed().toPromise();
  }

  private async confirm(options: ConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: options,
      width: '360px',
    });
    const result = await ref.afterClosed().toPromise();
    return result === true;
  }

  isRoadmapFile(file: FileItem): boolean {
    return file.name.toLowerCase().endsWith('.roadmap');
  }

  private getPathToId(nodes: TreeFolder[], targetId: string, path: string[] = []): string[] | null {
    for (const n of nodes) {
      const p = [...path, n.id];
      if (n.id === targetId) return p;
      const found = this.getPathToId(n.children, targetId, p);
      if (found) return found;
    }
    return null;
  }

  private getPathNodes(nodes: TreeFolder[], targetId: string, path: TreeFolder[] = []): TreeFolder[] | null {
    for (const n of nodes) {
      const p = [...path, n];
      if (n.id === targetId) return p;
      const found = this.getPathNodes(n.children, targetId, p);
      if (found) return found;
    }
    return null;
  }

  private expandPathTo(id: string | null): void {
    if (id === null) return;
    const path = this.getPathToId(this.folderTree, id);
    if (path) this.expandedIds = new Set(path);
  }

  onExpandToggle(id: string): void {
    this.expandedIds = new Set(this.expandedIds);
    if (this.expandedIds.has(id)) this.expandedIds.delete(id);
    else this.expandedIds.add(id);
  }

  async loadTree(): Promise<void> {
    try {
      const [tree, allFiles] = await Promise.all([
        this.api.getFolderTree(),
        this.api.getFiles(),
      ]);
      this.folderTree = tree;
      const byFolder = new Map<string, FileItem[]>();
      for (const file of allFiles) {
        const list = byFolder.get(file.folderId) ?? [];
        list.push(file);
        byFolder.set(file.folderId, list);
      }
      this.filesByFolderId = byFolder;
    } catch {
      this.folderTree = [];
      this.filesByFolderId = new Map();
    }
  }

  async selectFolder(id: string | null): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.currentFolderId = id;
      this.expandPathTo(id);

      this.childFolders = await this.api.getFoldersByParent(id);
      this.files = id === null ? [] : await this.api.getFiles(id);

      const pathNodes = id !== null ? this.getPathNodes(this.folderTree, id) : null;
      this.currentFolderPath = pathNodes
        ? pathNodes.map((n) => ({ id: n.id, name: n.name, parentId: null, createdAt: '', updatedAt: '' }))
        : [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async createFolder(): Promise<void> {
    const name = await this.prompt({
      title: 'Новая папка',
      message: 'Введите имя новой папки',
      placeholder: 'Имя папки',
    });
    if (!name) return;
    this.loading = true;
    this.error = null;
    try {
      await this.api.createFolder(name, this.currentFolderId);
      await this.loadTree();
      await this.selectFolder(this.currentFolderId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async renameFolder(folder: { id: string; name: string }): Promise<void> {
    const name = await this.prompt({
      title: 'Переименовать папку',
      message: `Новое имя для папки "${folder.name}":`,
      initialValue: folder.name,
      placeholder: 'Имя папки',
    });
    if (!name || name === folder.name) return;
    this.loading = true;
    this.error = null;
    try {
      await this.api.renameFolder(folder.id, name);
      await this.loadTree();
      await this.selectFolder(this.currentFolderId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async deleteFolder(folder: { id: string; name: string }): Promise<void> {
    const ok = await this.confirm({
      title: 'Удалить папку',
      message: `Удалить папку "${folder.name}" и всё её содержимое?`,
      confirmText: 'Удалить',
    });
    if (!ok) return;
    this.loading = true;
    this.error = null;
    try {
      await this.api.deleteFolder(folder.id);
      await this.loadTree();
      await this.selectFolder(this.currentFolderId === folder.id ? null : this.currentFolderId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async onFilesSelected(e: Event): Promise<void> {
    if (this.currentFolderId === null) return;
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.loading = true;
    this.error = null;
    try {
      for (const file of Array.from(input.files)) {
        await this.api.uploadFile(this.currentFolderId, file);
      }
      input.value = '';
      await this.loadTree();
      await this.selectFolder(this.currentFolderId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async renameFile(file: FileItem): Promise<void> {
    const name = await this.prompt({
      title: 'Переименовать файл',
      message: `Новое имя для файла "${file.name}":`,
      initialValue: file.name,
      placeholder: 'Имя файла',
    });
    if (!name || name === file.name) return;
    this.loading = true;
    this.error = null;
    try {
      await this.api.renameFile(file.id, name);
      await this.loadTree();
      await this.selectFolder(this.currentFolderId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async deleteFile(file: FileItem): Promise<void> {
    const ok = await this.confirm({
      title: 'Удалить файл',
      message: `Удалить файл "${file.name}"?`,
      confirmText: 'Удалить',
    });
    if (!ok) return;
    this.loading = true;
    this.error = null;
    try {
      await this.api.deleteFile(file.id);
      await this.loadTree();
      await this.selectFolder(this.currentFolderId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async createRoadmap(): Promise<void> {
    if (this.currentFolderId === null) return;
    const name = (await this.prompt({
      title: 'Новый роадмап',
      message: 'Введите имя файла роадмапа',
      placeholder: 'Имя файла',
      initialValue: 'Роадмап.roadmap',
      confirmText: 'Создать',
    }))?.trim();
    if (!name) return;
    const finalName = name.endsWith('.roadmap') ? name : name + '.roadmap';
    const initial: RoadmapData = { title: 'Роадмап', nodes: [] };
    const blob = new Blob([JSON.stringify(initial, null, 2)], { type: 'application/json' });
    const file = new File([blob], finalName, { type: 'application/json' });
    this.loading = true;
    this.error = null;
    try {
      const created = await this.api.uploadFile(this.currentFolderId, file);
      await this.loadTree();
      await this.selectFolder(this.currentFolderId);
      this.editingRoadmapFile = created;
      this.roadmapData = initial;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async openRoadmap(file: FileItem): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const data = await this.api.getFileContent(file.id);
      this.editingRoadmapFile = file;
      this.roadmapData = data;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  async saveRoadmap(data: RoadmapData): Promise<void> {
    if (!this.editingRoadmapFile) return;
    this.roadmapSaving = true;
    this.error = null;
    try {
      await this.api.putFileContent(this.editingRoadmapFile.id, data);
      await this.loadTree();
      this.closeRoadmapEditor();
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Не удалось сохранить роадмап';
    } finally {
      this.roadmapSaving = false;
    }
  }

  closeRoadmapEditor(): void {
    this.editingRoadmapFile = null;
    this.roadmapData = null;
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.currentFolderId !== null && e.dataTransfer?.types.includes('Files'))
      this.dropZoneActive = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dropZoneActive = false;
  }

  async onDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    this.dropZoneActive = false;
    if (this.currentFolderId === null) return;
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    this.loading = true;
    this.error = null;
    try {
      for (const file of Array.from(files)) {
        await this.api.uploadFile(this.currentFolderId, file);
      }
      await this.loadTree();
      await this.selectFolder(this.currentFolderId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Неизвестная ошибка';
    } finally {
      this.loading = false;
    }
  }

  getFileDownloadUrl(fileId: string): string {
    return this.api.getFileDownloadUrl(fileId);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }
}
