import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FoldersModule } from './folders/folders.module';
import { FilesModule } from './files/files.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [StorageModule, FoldersModule, FilesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
