import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { diskStorage } from 'multer';
import { StorageService } from '../storage/storage.service';
import type { FileEntity } from '../storage/metadata.types';
import { randomUUID } from 'node:crypto';
import { RenameFileDto } from './dto/rename-file.dto';

interface UploadedFileShape {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

type NodeKind = 'main' | 'branch';
type NodeColorType = 'blue' | 'red' | 'yellow' | 'white' | 'orange' | 'green';
type ChildrenDisplayStyle = 'separate-paths' | 'single-path-block';

interface RoadmapNodeShape {
  id: string;
  label: string;
  type: NodeKind;
  order?: number;
  parentId?: string;
  content?: string;
  colorType?: NodeColorType;
  childrenDisplay?: ChildrenDisplayStyle;
  x?: number;
  y?: number;
}

interface RoadmapDataShape {
  title: string;
  nodes: RoadmapNodeShape[];
  defaultChildrenDisplay?: ChildrenDisplayStyle;
}

/** Исправляет имя файла: браузер может отправить UTF-8 как latin1 */
function decodeFileName(name: string): string {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

function mapLegacyColorToType(color: unknown): NodeColorType | undefined {
  if (typeof color !== 'string') return undefined;
  const normalized = color.trim().toLowerCase();
  const byHex: Record<string, NodeColorType> = {
    '#3498db': 'blue',
    '#e74c3c': 'red',
    '#f6c445': 'yellow',
    '#ffffff': 'white',
    '#f2994a': 'orange',
    '#33c46b': 'green',
  };
  return byHex[normalized];
}

function isColorType(value: unknown): value is NodeColorType {
  return (
    value === 'blue' ||
    value === 'red' ||
    value === 'yellow' ||
    value === 'white' ||
    value === 'orange' ||
    value === 'green'
  );
}

function isChildrenDisplay(value: unknown): value is ChildrenDisplayStyle {
  return value === 'separate-paths' || value === 'single-path-block';
}

function normalizeRoadmapData(input: unknown): RoadmapDataShape {
  const raw = (input ?? {}) as Record<string, unknown>;
  const nodesRaw = Array.isArray(raw['nodes']) ? raw['nodes'] : [];

  const nodes: RoadmapNodeShape[] = nodesRaw
    .map((item) => (item ?? {}) as Record<string, unknown>)
    .filter((n) => typeof n['id'] === 'string')
    .map((n) => {
      const normalizedType: NodeKind = n['type'] === 'main' ? 'main' : 'branch';
      const explicitColorType = isColorType(n['colorType']) ? n['colorType'] : undefined;
      const migratedColorType = explicitColorType ?? mapLegacyColorToType(n['color']);
      const label =
        typeof n['label'] === 'string' ? n['label'] : n['label'] != null ? String(n['label']) : '';
      return {
        id: n['id'] as string,
        label,
        type: normalizedType,
        ...(typeof n['order'] === 'number' ? { order: n['order'] } : {}),
        ...(typeof n['parentId'] === 'string' ? { parentId: n['parentId'] } : {}),
        ...(typeof n['content'] === 'string' ? { content: n['content'] } : {}),
        ...(migratedColorType ? { colorType: migratedColorType } : {}),
        ...(isChildrenDisplay(n['childrenDisplay'])
          ? { childrenDisplay: n['childrenDisplay'] }
          : {}),
        ...(typeof n['x'] === 'number' && Number.isFinite(n['x']) ? { x: n['x'] } : {}),
        ...(typeof n['y'] === 'number' && Number.isFinite(n['y']) ? { y: n['y'] } : {}),
      };
    });

  return {
    title: typeof raw['title'] === 'string' ? raw['title'] : 'Роадмап',
    nodes,
    ...(isChildrenDisplay(raw['defaultChildrenDisplay'])
      ? { defaultChildrenDisplay: raw['defaultChildrenDisplay'] }
      : {}),
  };
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
    if (!file?.path) {
      throw new BadRequestException('File required');
    }
    const name = decodeFileName(file.originalname);
    return this.storage.createFile({
      folderId,
      name,
      size: file.size,
      mimeType: file.mimetype,
      originalName: name,
      storagePath: path.basename(file.path),
    });
  }

  @Patch(':id')
  async rename(
    @Param('id') id: string,
    @Body() body: RenameFileDto,
  ): Promise<FileEntity> {
    const updated = await this.storage.renameFile(id, body.name);
    if (!updated) {
      throw new NotFoundException('File not found');
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
      throw new NotFoundException('File not found');
    }
    const abs = this.storage.getPhysicalPath(file);
    try {
      await fs.promises.access(abs, fs.constants.F_OK);
    } catch {
      throw new NotFoundException('File not found on disk');
    }
    res.download(abs, file.name);
  }

  @Get(':id/content')
  async getContent(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.storage.getFileById(id);
    if (!file) {
      throw new NotFoundException('File not found');
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = { title: 'Роадмап', nodes: [] };
    }
    const normalized = normalizeRoadmapData(parsed);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(normalized));
  }

  @Put(':id/content')
  async putContent(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ ok: boolean }> {
    const file = await this.storage.getFileById(id);
    if (!file) {
      throw new NotFoundException('File not found');
    }
    const filePath = this.storage.getPhysicalPath(file);
    let parsed: unknown;
    try {
      parsed =
        typeof req.body === 'string'
          ? (JSON.parse(req.body) as unknown)
          : (req.body as unknown);
    } catch {
      throw new BadRequestException('Invalid roadmap JSON');
    }
    const normalized = normalizeRoadmapData(parsed);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(normalized, null, 2),
      'utf8',
    );
    return { ok: true };
  }
}
