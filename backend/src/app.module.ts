import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FoldersModule } from './folders/folders.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [FoldersModule, FilesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
