import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Folder, TreeFolder, FileItem, RoadmapData } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = '/api';

  constructor(private http: HttpClient) {}

  getFolderTree(): Promise<TreeFolder[]> {
    return firstValueFrom(
      this.http.get<TreeFolder[]>(`${this.base}/folders/tree`),
    );
  }

  getFoldersByParent(parentId: string | null): Promise<Folder[]> {
    const q = parentId === null ? 'null' : parentId;
    return firstValueFrom(
      this.http.get<Folder[]>(`${this.base}/folders`, {
        params: { parentId: q },
      }),
    );
  }

  createFolder(name: string, parentId: string | null): Promise<Folder> {
    return firstValueFrom(
      this.http.post<Folder>(`${this.base}/folders`, { name, parentId }),
    );
  }

  renameFolder(id: string, name: string): Promise<Folder> {
    return firstValueFrom(
      this.http.patch<Folder>(`${this.base}/folders/${id}`, { name }),
    );
  }

  deleteFolder(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/folders/${id}`),
    );
  }

  getFiles(folderId?: string): Promise<FileItem[]> {
    const hasFolder = folderId != null && folderId !== '';
    const url = hasFolder
      ? `${this.base}/files`
      : `${this.base}/files`;
    const options = hasFolder ? { params: { folderId: folderId! } } : {};
    return firstValueFrom(this.http.get<FileItem[]>(url, options));
  }

  uploadFile(folderId: string, file: File): Promise<FileItem> {
    const form = new FormData();
    form.append('folderId', folderId);
    form.append('file', file);
    return firstValueFrom(
      this.http.post<FileItem>(`${this.base}/files`, form),
    );
  }

  renameFile(id: string, name: string): Promise<FileItem> {
    return firstValueFrom(
      this.http.patch<FileItem>(`${this.base}/files/${id}`, { name }),
    );
  }

  deleteFile(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.base}/files/${id}`),
    );
  }

  getFileDownloadUrl(id: string): string {
    return `${this.base}/files/${id}/download`;
  }

  getFileContent(id: string): Promise<RoadmapData> {
    return firstValueFrom(
      this.http.get<RoadmapData>(`${this.base}/files/${id}/content`),
    );
  }

  putFileContent(id: string, data: RoadmapData): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(`${this.base}/files/${id}/content`, data),
    );
  }
}
