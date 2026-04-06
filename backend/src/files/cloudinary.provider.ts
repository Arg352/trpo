import { v2 as cloudinary } from 'cloudinary';

export const CloudinaryProvider = {
    provide: 'CLOUDINARY',
    useFactory: () => {
        // cloudinary автоматически подхватывает CLOUDINARY_URL из .env
        // Формат: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
        return cloudinary;
    },
};
