import {
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
    constructor(private readonly filesService: FilesService) { }

    @Post('upload')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(), // Файл в RAM (buffer), не на диск
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 МБ
            fileFilter: (_req, file, callback) => {
                if (!file.mimetype.match(/^(image|video)\//)) {
                    return callback(
                        new Error('Разрешены только изображения и видео'),
                        false,
                    );
                }
                callback(null, true);
            },
        }),
    )
    uploadFile(@UploadedFile() file: Express.Multer.File) {
        return this.filesService.uploadFile(file.buffer, file.originalname);
    }
}
