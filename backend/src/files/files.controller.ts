import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { diskStorage } from 'multer';
import { StorageService } from '../storage/storage.service';
import type { FileEntity } from '../storage/metadata.types';
import { randomUUID } from 'node:crypto';

interface RenameFileDto {
  name: string;
}

@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  getByFolder(@Query('folderId') folderId: string): Promise<FileEntity[]> {
    return this.storage.getFilesByFolder(folderId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = path.join(process.cwd(), 'storage', 'files');
          fs.mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, randomUUID() + ext);
        },
      }),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('folderId') folderId: string,
  ): Promise<FileEntity> {
    return this.storage.createFile({
      folderId,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
      storagePath: file.path,
    });
  }

  @Patch(':id')
  async rename(
    @Param('id') id: string,
    @Body() body: RenameFileDto,
  ): Promise<FileEntity> {
    const updated = await this.storage.renameFile(id, body.name);
    if (!updated) {
      throw new Error('File not found');
    }
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.storage.deleteFile(id);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.storage.getFileById(id);
    if (!file) {
      res.status(404).send('Not found');
      return;
    }
    res.download(this.storage.getPhysicalPath(file), file.name);
  }
}

