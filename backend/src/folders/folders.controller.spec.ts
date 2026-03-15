import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FoldersController } from './folders.controller';
import { StorageService } from '../storage/storage.service';
import type { FolderEntity } from '../storage/metadata.types';
import type { TreeFolderDto } from '../storage/tree.types';

describe('FoldersController', () => {
  let controller: FoldersController;
  let storage: jest.Mocked<Pick<StorageService, 'getFolderTree' | 'getFoldersByParent' | 'createFolder' | 'renameFolder' | 'deleteFolderRecursive'>>;

  const mockFolder: FolderEntity = {
    id: 'folder-id',
    name: 'Test',
    parentId: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  const mockTree: TreeFolderDto[] = [
    { id: 'folder-id', name: 'Test', children: [] },
  ];

  beforeEach(async () => {
    storage = {
      getFolderTree: jest.fn().mockResolvedValue(mockTree),
      getFoldersByParent: jest.fn().mockResolvedValue([mockFolder]),
      createFolder: jest.fn().mockResolvedValue(mockFolder),
      renameFolder: jest.fn().mockResolvedValue(mockFolder),
      deleteFolderRecursive: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FoldersController],
      providers: [
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    controller = module.get<FoldersController>(FoldersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTree', () => {
    it('returns folder tree from storage', async () => {
      const result = await controller.getTree();
      expect(result).toEqual(mockTree);
      expect(storage.getFolderTree).toHaveBeenCalledTimes(1);
    });
  });

  describe('getByParent', () => {
    it('calls getFoldersByParent with null when parentId is undefined', async () => {
      await controller.getByParent(undefined);
      expect(storage.getFoldersByParent).toHaveBeenCalledWith(null);
    });

    it('calls getFoldersByParent with null when parentId is "null"', async () => {
      await controller.getByParent('null');
      expect(storage.getFoldersByParent).toHaveBeenCalledWith(null);
    });

    it('calls getFoldersByParent with id when parentId is provided', async () => {
      await controller.getByParent('some-uuid');
      expect(storage.getFoldersByParent).toHaveBeenCalledWith('some-uuid');
    });
  });

  describe('create', () => {
    it('calls createFolder with name and parentId', async () => {
      await controller.create({ name: 'New Folder', parentId: null });
      expect(storage.createFolder).toHaveBeenCalledWith('New Folder', null);
    });

    it('normalizes "null" parentId string to null', async () => {
      await controller.create({ name: 'Child', parentId: 'null' as unknown as null });
      expect(storage.createFolder).toHaveBeenCalledWith('Child', null);
    });
  });

  describe('rename', () => {
    it('returns updated folder', async () => {
      const result = await controller.rename('folder-id', { name: 'Renamed' });
      expect(result).toEqual(mockFolder);
      expect(storage.renameFolder).toHaveBeenCalledWith('folder-id', 'Renamed');
    });

    it('throws NotFoundException when folder not found', async () => {
      (storage.renameFolder as jest.Mock).mockResolvedValue(null);
      await expect(
        controller.rename('missing-id', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('calls deleteFolderRecursive', async () => {
      await controller.remove('folder-id');
      expect(storage.deleteFolderRecursive).toHaveBeenCalledWith('folder-id');
    });
  });
});
