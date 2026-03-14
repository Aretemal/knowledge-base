import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { diskStorage } from 'multer';
import { StorageService } from '../storage/storage.service';
import type { FileEntity } from '../storage/metadata.types';
import { randomUUID } from 'node:crypto';

interface RenameFileDto {
  name: string;
}

interface UploadedFileShape {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

/** Исправляет имя файла: браузер может отправить UTF-8 как latin1 */
function decodeFileName(name: string): string {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  getByFolder(@Query('folderId') folderId?: string): Promise<FileEntity[]> {
    if (folderId != null && folderId !== '') {
      return this.storage.getFilesByFolder(folderId);
    }
    return this.storage.getAllFiles();
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
    @UploadedFile() file: UploadedFileShape | undefined,
    @Body('folderId') folderId: string,
  ): Promise<FileEntity> {
    if (!file?.path) throw new Error('File required');
    const name = decodeFileName(file.originalname);
    return this.storage.createFile({
      folderId,
      name,
      size: file.size,
      mimeType: file.mimetype,
      originalName: name,
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

  @Get(':id/content')
  async getContent(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.storage.getFileById(id);
    if (!file) {
      res.status(404).send('Not found');
      return;
    }
    const filePath = this.storage.getPhysicalPath(file);
    let raw: string;
    try {
      raw = await fs.promises.readFile(filePath, 'utf8');
    } catch {
      raw = '';
    }
    if (!raw.trim()) {
      raw = JSON.stringify({ title: 'Роадмап', nodes: [] });
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(raw);
  }

  @Put(':id/content')
  async putContent(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    const file = await this.storage.getFileById(id);
    if (!file) {
      throw new Error('File not found');
    }
    const filePath = this.storage.getPhysicalPath(file);
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    await fs.promises.writeFile(filePath, body, 'utf8');
    return { ok: true };
  }
}

