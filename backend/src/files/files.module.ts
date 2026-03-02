import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [FilesController],
  providers: [StorageService],
})
export class FilesModule {}

