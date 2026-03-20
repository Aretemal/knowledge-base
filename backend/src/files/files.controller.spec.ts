import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'node:fs';
import { FilesController } from './files.controller';
import { StorageService } from '../storage/storage.service';
import type { FileEntity } from '../storage/metadata.types';

describe('FilesController', () => {
  let controller: FilesController;
  let storage: jest.Mocked<Pick<StorageService, 'getFilesByFolder' | 'getAllFiles' | 'getFileById' | 'createFile' | 'renameFile' | 'deleteFile' | 'getPhysicalPath'>>;

  const mockFile: FileEntity = {
    id: 'file-id',
    name: 'doc.txt',
    folderId: 'folder-id',
    size: 100,
    mimeType: 'text/plain',
    createdAt: '2025-01-01T00:00:00.000Z',
    originalName: 'doc.txt',
    storagePath: 'abc.txt',
  };

  beforeEach(async () => {
    storage = {
      getFilesByFolder: jest.fn().mockResolvedValue([mockFile]),
      getAllFiles: jest.fn().mockResolvedValue([mockFile]),
      getFileById: jest.fn().mockResolvedValue(mockFile),
      createFile: jest.fn().mockResolvedValue(mockFile),
      renameFile: jest.fn().mockResolvedValue(mockFile),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getPhysicalPath: jest.fn().mockReturnValue(mockFile.storagePath),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    controller = module.get<FilesController>(FilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getByFolder', () => {
    it('returns getFilesByFolder when folderId provided', async () => {
      const result = await controller.getByFolder('folder-id');
      expect(result).toEqual([mockFile]);
      expect(storage.getFilesByFolder).toHaveBeenCalledWith('folder-id');
      expect(storage.getAllFiles).not.toHaveBeenCalled();
    });

    it('returns getAllFiles when folderId empty', async () => {
      await controller.getByFolder('');
      expect(storage.getAllFiles).toHaveBeenCalled();
      expect(storage.getFilesByFolder).not.toHaveBeenCalled();
    });

    it('returns getAllFiles when folderId undefined', async () => {
      await controller.getByFolder(undefined);
      expect(storage.getAllFiles).toHaveBeenCalled();
    });
  });

  describe('upload', () => {
    it('creates file when file and folderId provided', async () => {
      const result = await controller.upload(
        {
          originalname: 'upload.txt',
          mimetype: 'text/plain',
          size: 10,
          path: '/tmp/upload.txt',
        },
        'folder-id',
      );
      expect(result).toEqual(mockFile);
      expect(storage.createFile).toHaveBeenCalledWith(
        expect.objectContaining({
          folderId: 'folder-id',
          name: 'upload.txt',
          size: 10,
          mimeType: 'text/plain',
          originalName: 'upload.txt',
          storagePath: 'upload.txt',
        }),
      );
    });

    it('throws BadRequestException when file is missing', async () => {
      await expect(
        controller.upload(undefined, 'folder-id'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.upload({ originalname: 'x', mimetype: 'y', size: 0, path: '' }, 'folder-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rename', () => {
    it('returns updated file', async () => {
      const result = await controller.rename('file-id', { name: 'new.txt' });
      expect(result).toEqual(mockFile);
      expect(storage.renameFile).toHaveBeenCalledWith('file-id', 'new.txt');
    });

    it('throws NotFoundException when file not found', async () => {
      (storage.renameFile as jest.Mock).mockResolvedValue(null);
      await expect(
        controller.rename('missing-id', { name: 'x.txt' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('calls deleteFile', async () => {
      await controller.remove('file-id');
      expect(storage.deleteFile).toHaveBeenCalledWith('file-id');
    });
  });

  describe('download', () => {
    it('throws NotFoundException when file not found', async () => {
      (storage.getFileById as jest.Mock).mockResolvedValue(undefined);
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        download: jest.fn(),
      };
      await expect(
        controller.download('missing-id', res as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls res.download when file exists on disk', async () => {
      const accessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      const res = {
        download: jest.fn(),
      };
      try {
        await controller.download('file-id', res as any);
        expect(storage.getFileById).toHaveBeenCalledWith('file-id');
        expect(storage.getPhysicalPath).toHaveBeenCalledWith(mockFile);
        expect(res.download).toHaveBeenCalledWith(mockFile.storagePath, mockFile.name);
      } finally {
        accessSpy.mockRestore();
      }
    });
  });

  describe('getContent', () => {
    it('throws NotFoundException when file not found', async () => {
      (storage.getFileById as jest.Mock).mockResolvedValue(undefined);
      const res = { setHeader: jest.fn(), send: jest.fn(), status: jest.fn().mockReturnThis() };
      await expect(
        controller.getContent('missing-id', res as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('putContent', () => {
    it('throws NotFoundException when file not found', async () => {
      (storage.getFileById as jest.Mock).mockResolvedValue(undefined);
      const req = { body: {} };
      await expect(
        controller.putContent('missing-id', req as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
