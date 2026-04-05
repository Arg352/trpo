import { Injectable } from '@nestjs/common';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class FilesService {
    async uploadFile(
        fileBuffer: Buffer,
        originalName: string,
    ): Promise<{ url: string }> {
        const result = await new Promise<UploadApiResponse>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'auto', // Поддержка картинок, видео, raw-файлов
                    folder: 'tech-store',  // Папка в Cloudinary
                },
                (error, result) => {
                    if (error || !result) {
                        return reject(error ?? new Error('Ошибка загрузки в Cloudinary'));
                    }
                    resolve(result);
                },
            );

            // Превращаем buffer в readable stream и передаём в Cloudinary
            streamifier.createReadStream(fileBuffer).pipe(uploadStream);
        });

        return { url: result.secure_url };
    }
}
