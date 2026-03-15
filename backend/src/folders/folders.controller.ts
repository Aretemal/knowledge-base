import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  NotFoundException,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import type { FolderEntity } from '../storage/metadata.types';
import type { TreeFolderDto } from '../storage/tree.types';
import { CreateFolderDto } from './dto/create-folder.dto';
import { RenameFolderDto } from './dto/rename-folder.dto';

@Controller('folders')
export class FoldersController {
  constructor(private readonly storage: StorageService) {}

  @Get('tree')
  getTree(): Promise<TreeFolderDto[]> {
    return this.storage.getFolderTree();
  }

  @Get()
  getByParent(
    @Query('parentId') parentId?: string | null,
  ): Promise<FolderEntity[]> {
    const normalized =
      parentId === undefined || parentId === 'null' ? null : parentId;
    return this.storage.getFoldersByParent(normalized);
  }

  @Post()
  create(@Body() body: CreateFolderDto): Promise<FolderEntity> {
    const parentId =
      body.parentId === undefined || body.parentId === 'null'
        ? null
        : body.parentId;
    return this.storage.createFolder(body.name, parentId);
  }

  @Patch(':id')
  async rename(
    @Param('id') id: string,
    @Body() body: RenameFolderDto,
  ): Promise<FolderEntity> {
    const updated = await this.storage.renameFolder(id, body.name);
    if (!updated) {
      throw new NotFoundException('Folder not found');
    }
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.storage.deleteFolderRecursive(id);
  }
}
