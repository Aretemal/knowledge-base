import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StorageService, STORAGE_BASE_PATH } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `kb-storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(testDir, { recursive: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_BASE_PATH, useValue: testDir },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('folders', () => {
    it('getAllFolders returns empty array initially', async () => {
      const folders = await service.getAllFolders();
      expect(folders).toEqual([]);
    });

    it('createFolder adds folder and getFolderById returns it', async () => {
      const folder = await service.createFolder('Test Folder', null);
      expect(folder.name).toBe('Test Folder');
      expect(folder.parentId).toBeNull();
      expect(folder.id).toBeDefined();
      expect(folder.createdAt).toBeDefined();
      expect(folder.updatedAt).toBeDefined();

      const found = await service.getFolderById(folder.id);
      expect(found).toEqual(folder);
    });

    it('getFoldersByParent returns only children of parent', async () => {
      const root = await service.createFolder('Root', null);
      const child1 = await service.createFolder('Child1', root.id);
      await service.createFolder('Child2', root.id);
      await service.createFolder('Nested', child1.id);

      const rootChildren = await service.getFoldersByParent(root.id);
      expect(rootChildren).toHaveLength(2);
      expect(rootChildren.map((f) => f.name).sort()).toEqual(['Child1', 'Child2']);

      const topLevel = await service.getFoldersByParent(null);
      expect(topLevel).toHaveLength(1);
      expect(topLevel[0].name).toBe('Root');
    });

    it('renameFolder updates name', async () => {
      const folder = await service.createFolder('Old', null);
      const updated = await service.renameFolder(folder.id, 'New');
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New');
      const found = await service.getFolderById(folder.id);
      expect(found!.name).toBe('New');
    });

    it('renameFolder returns null for unknown id', async () => {
      const updated = await service.renameFolder('non-existent-uuid', 'Name');
      expect(updated).toBeNull();
    });

    it('getFolderTree returns tree structure', async () => {
      const root = await service.createFolder('Root', null);
      await service.createFolder('ChildA', root.id);
      await service.createFolder('ChildB', root.id);

      const tree = await service.getFolderTree();
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('Root');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children.map((c) => c.name).sort()).toEqual(['ChildA', 'ChildB']);
    });

    it('deleteFolderRecursive removes folder and children', async () => {
      const root = await service.createFolder('Root', null);
      const child = await service.createFolder('Child', root.id);
      await service.deleteFolderRecursive(root.id);

      expect(await service.getFolderById(root.id)).toBeUndefined();
      expect(await service.getFolderById(child.id)).toBeUndefined();
      expect(await service.getAllFolders()).toHaveLength(0);
    });
  });

  describe('files', () => {
    let folderId: string;

    beforeEach(async () => {
      const folder = await service.createFolder('Files', null);
      folderId = folder.id;
    });

    it('createFile and getFileById', async () => {
      const filePath = path.join(testDir, 'files', 'test.txt');
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, 'content', 'utf8');

      const file = await service.createFile({
        folderId,
        name: 'test.txt',
        size: 7,
        mimeType: 'text/plain',
        originalName: 'test.txt',
        storagePath: filePath,
      });
      expect(file.id).toBeDefined();
      expect(file.name).toBe('test.txt');
      expect(file.folderId).toBe(folderId);

      const found = await service.getFileById(file.id);
      expect(found).toEqual(file);
    });

    it('getFilesByFolder returns only files in folder', async () => {
      const filePath = path.join(testDir, 'files', 'f1.txt');
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, 'x', 'utf8');
      await service.createFile({
        folderId,
        name: 'f1.txt',
        size: 1,
        mimeType: 'text/plain',
        originalName: 'f1.txt',
        storagePath: filePath,
      });

      const otherFolder = await service.createFolder('Other', null);
      const otherPath = path.join(testDir, 'files', 'f2.txt');
      await fs.promises.writeFile(otherPath, 'y', 'utf8');
      await service.createFile({
        folderId: otherFolder.id,
        name: 'f2.txt',
        size: 1,
        mimeType: 'text/plain',
        originalName: 'f2.txt',
        storagePath: otherPath,
      });

      const list = await service.getFilesByFolder(folderId);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('f1.txt');
    });

    it('renameFile and deleteFile', async () => {
      const filePath = path.join(testDir, 'files', 'orig.txt');
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, 'x', 'utf8');
      const file = await service.createFile({
        folderId,
        name: 'orig.txt',
        size: 1,
        mimeType: 'text/plain',
        originalName: 'orig.txt',
        storagePath: filePath,
      });

      const updated = await service.renameFile(file.id, 'renamed.txt');
      expect(updated!.name).toBe('renamed.txt');

      await service.deleteFile(file.id);
      expect(await service.getFileById(file.id)).toBeUndefined();
    });

    it('getPhysicalPath returns storagePath', async () => {
      const filePath = path.join(testDir, 'files', 'p.txt');
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, 'x', 'utf8');
      const file = await service.createFile({
        folderId,
        name: 'p.txt',
        size: 1,
        mimeType: 'text/plain',
        originalName: 'p.txt',
        storagePath: filePath,
      });
      expect(service.getPhysicalPath(file)).toBe(filePath);
    });
  });
});
