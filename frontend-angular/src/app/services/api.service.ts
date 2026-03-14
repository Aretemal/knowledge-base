import { Injectable } from '@angular/core';
import type { Folder, TreeFolder, FileItem, RoadmapData } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api';

  async getFolderTree(): Promise<TreeFolder[]> {
    const res = await fetch(`${this.base}/folders/tree`);
    if (!res.ok) throw new Error('Ошибка загрузки дерева');
    return res.json();
  }

  async getFoldersByParent(parentId: string | null): Promise<Folder[]> {
    const q = parentId === null ? 'null' : parentId;
    const res = await fetch(`${this.base}/folders?parentId=${q}`);
    if (!res.ok) throw new Error('Ошибка загрузки папок');
    return res.json();
  }

  async createFolder(name: string, parentId: string | null): Promise<Folder> {
    const res = await fetch(`${this.base}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
    if (!res.ok) throw new Error('Не удалось создать папку');
    return res.json();
  }

  async renameFolder(id: string, name: string): Promise<Folder> {
    const res = await fetch(`${this.base}/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Не удалось переименовать папку');
    return res.json();
  }

  async deleteFolder(id: string): Promise<void> {
    const res = await fetch(`${this.base}/folders/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Не удалось удалить папку');
  }

  async getFiles(folderId?: string): Promise<FileItem[]> {
    const url = folderId != null && folderId !== ''
      ? `${this.base}/files?folderId=${encodeURIComponent(folderId)}`
      : `${this.base}/files`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Ошибка загрузки файлов');
    return res.json();
  }

  async uploadFile(folderId: string, file: File): Promise<FileItem> {
    const form = new FormData();
    form.append('folderId', folderId);
    form.append('file', file);
    const res = await fetch(`${this.base}/files`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Не удалось загрузить ${file.name}`);
    return res.json();
  }

  async renameFile(id: string, name: string): Promise<FileItem> {
    const res = await fetch(`${this.base}/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Не удалось переименовать файл');
    return res.json();
  }

  async deleteFile(id: string): Promise<void> {
    const res = await fetch(`${this.base}/files/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Не удалось удалить файл');
  }

  getFileDownloadUrl(id: string): string {
    return `${this.base}/files/${id}/download`;
  }

  async getFileContent(id: string): Promise<RoadmapData> {
    const res = await fetch(`${this.base}/files/${id}/content`);
    if (!res.ok) throw new Error('Не удалось загрузить роадмап');
    return res.json();
  }

  async putFileContent(id: string, data: RoadmapData): Promise<void> {
    const res = await fetch(`${this.base}/files/${id}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Ошибка сохранения');
  }
}
