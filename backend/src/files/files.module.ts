import { Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
    controllers: [FilesController],
    providers: [CloudinaryProvider, FilesService],
    exports: [FilesService],
})
export class FilesModule { }
