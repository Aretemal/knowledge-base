import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileEntity, FolderEntity, MetadataStore } from './metadata.types';
import type { TreeFolderDto } from './tree.types';

export const STORAGE_BASE_PATH = 'STORAGE_BASE_PATH';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly baseDir: string;
  private readonly filesDir: string;
  private readonly metadataPath: string;

  constructor(
    @Optional() @Inject(STORAGE_BASE_PATH) basePath?: string,
  ) {
    this.baseDir = basePath ?? path.join(process.cwd(), 'storage');
    this.filesDir = path.join(this.baseDir, 'files');
    this.metadataPath = path.join(this.baseDir, 'metadata.json');
  }

  async onModuleInit() {
    await this.ensureDirs();
    await this.ensureMetadata();
  }

  async getAllFolders(): Promise<FolderEntity[]> {
    const data = await this.readMetadata();
    return data.folders;
  }

  async getFoldersByParent(parentId: string | null): Promise<FolderEntity[]> {
    const data = await this.readMetadata();
    return data.folders.filter((f) => f.parentId === parentId);
  }

  async getFolderTree(): Promise<TreeFolderDto[]> {
    const all = await this.getAllFolders();
    const byParent = new Map<string | null, FolderEntity[]>();
    for (const f of all) {
      const key = f.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(f);
    }
    const build = (parentId: string | null): TreeFolderDto[] => {
      const list = byParent.get(parentId) ?? [];
      return list
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({
          id: f.id,
          name: f.name,
          children: build(f.id),
        }));
    };
    return build(null);
  }

  async getFolderById(id: string): Promise<FolderEntity | undefined> {
    const data = await this.readMetadata();
    return data.folders.find((f) => f.id === id);
  }

  async createFolder(
    name: string,
    parentId: string | null,
  ): Promise<FolderEntity> {
    const data = await this.readMetadata();
    const now = new Date().toISOString();
    const folder: FolderEntity = {
      id: randomUUID(),
      name,
      parentId,
      createdAt: now,
      updatedAt: now,
    };
    data.folders.push(folder);
    await this.writeMetadata(data);
    return folder;
  }

  async renameFolder(id: string, name: string): Promise<FolderEntity | null> {
    const data = await this.readMetadata();
    const folder = data.folders.find((f) => f.id === id);
    if (!folder) {
      return null;
    }
    folder.name = name;
    folder.updatedAt = new Date().toISOString();
    await this.writeMetadata(data);
    return folder;
  }

  async deleteFolderRecursive(id: string): Promise<void> {
    const data = await this.readMetadata();
    const foldersToDelete = new Set<string>();
    const collect = (folderId: string) => {
      foldersToDelete.add(folderId);
      for (const child of data.folders.filter((f) => f.parentId === folderId)) {
        collect(child.id);
      }
    };
    collect(id);

    const filesToDelete = data.files.filter((f) =>
      foldersToDelete.has(f.folderId),
    );
    for (const file of filesToDelete) {
      await this.safeUnlink(file.storagePath);
    }

    data.files = data.files.filter(
      (f) => !foldersToDelete.has(f.folderId),
    );
    data.folders = data.folders.filter((f) => !foldersToDelete.has(f.id));

    await this.writeMetadata(data);
  }

  async getFilesByFolder(folderId: string): Promise<FileEntity[]> {
    const data = await this.readMetadata();
    return data.files.filter((f) => f.folderId === folderId);
  }

  async getAllFiles(): Promise<FileEntity[]> {
    const data = await this.readMetadata();
    return data.files;
  }

  async getFileById(id: string): Promise<FileEntity | undefined> {
    const data = await this.readMetadata();
    return data.files.find((f) => f.id === id);
  }

  async createFile(params: {
    folderId: string;
    name: string;
    size: number;
    mimeType: string;
    originalName: string;
    storagePath: string;
  }): Promise<FileEntity> {
    const data = await this.readMetadata();
    const now = new Date().toISOString();
    const file: FileEntity = {
      id: randomUUID(),
      createdAt: now,
      ...params,
    };
    data.files.push(file);
    await this.writeMetadata(data);
    return file;
  }

  async renameFile(id: string, name: string): Promise<FileEntity | null> {
    const data = await this.readMetadata();
    const file = data.files.find((f) => f.id === id);
    if (!file) {
      return null;
    }
    file.name = name;
    await this.writeMetadata(data);
    return file;
  }

  async deleteFile(id: string): Promise<void> {
    const data = await this.readMetadata();
    const file = data.files.find((f) => f.id === id);
    if (!file) {
      return;
    }
    await this.safeUnlink(file.storagePath);
    data.files = data.files.filter((f) => f.id !== id);
    await this.writeMetadata(data);
  }

  getPhysicalPath(file: FileEntity): string {
    return file.storagePath;
  }

  private async ensureDirs() {
    await fs.promises.mkdir(this.filesDir, { recursive: true });
  }

  private async ensureMetadata() {
    try {
      await fs.promises.access(this.metadataPath, fs.constants.F_OK);
      await this.migrateRemoveRoot();
      await this.migrateFixFileNamesEncoding();
    } catch {
      const initial: MetadataStore = {
        folders: [],
        files: [],
      };
      await this.writeMetadata(initial);
    }
  }

  /** Исправляет имена файлов, сохранённые как latin1 вместо UTF-8 (кириллица) */
  private async migrateFixFileNamesEncoding(): Promise<void> {
    const data = await this.readMetadata();
    const decode = (s: string): string => {
      try {
        return Buffer.from(s, 'latin1').toString('utf8');
      } catch {
        return s;
      }
    };
    let changed = false;
    for (const file of data.files) {
      if (file.name.includes('Ð')) {
        file.name = decode(file.name);
        file.originalName = decode(file.originalName);
        changed = true;
      }
    }
    if (changed) await this.writeMetadata(data);
  }

  /** Удаляет папку root из метаданных и переносит её содержимое на верхний уровень */
  private async migrateRemoveRoot(): Promise<void> {
    const data = await this.readMetadata();
    const hasRoot = data.folders.some((f) => f.id === 'root');
    if (!hasRoot) return;

    for (const f of data.folders) {
      if (f.parentId === 'root') f.parentId = null;
    }
    data.folders = data.folders.filter((f) => f.id !== 'root');

    const rootFiles = data.files.filter((f) => f.folderId === 'root');
    if (rootFiles.length > 0) {
      const now = new Date().toISOString();
      const uploadsFolder: FolderEntity = {
        id: randomUUID(),
        name: 'Загрузки',
        parentId: null,
        createdAt: now,
        updatedAt: now,
      };
      data.folders.push(uploadsFolder);
      for (const file of rootFiles) file.folderId = uploadsFolder.id;
    }
    await this.writeMetadata(data);
  }

  private async readMetadata(): Promise<MetadataStore> {
    const raw = await fs.promises.readFile(this.metadataPath, 'utf8');
    return JSON.parse(raw) as MetadataStore;
  }

  private async writeMetadata(data: MetadataStore): Promise<void> {
    const tmpPath = this.metadataPath + '.tmp';
    await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.promises.rename(tmpPath, this.metadataPath);
  }

  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // ignore errors when deleting files
    }
  }
}

