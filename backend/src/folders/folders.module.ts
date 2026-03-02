import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [FoldersController],
  providers: [StorageService],
  exports: [StorageService],
})
export class FoldersModule {}

