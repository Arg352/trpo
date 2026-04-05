import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBannerDto {
    @ApiProperty({ description: 'Заголовок баннера' })
    @IsString()
    @IsNotEmpty({ message: 'Заголовок баннера обязателен' })
    title: string;

    @ApiPropertyOptional({ description: 'Подзаголовок' })
    @IsOptional()
    @IsString()
    subtitle?: string;

    @ApiPropertyOptional({ description: 'Текст скидки (например, "-20%")' })
    @IsOptional()
    @IsString()
    discount?: string;

    @ApiProperty({ description: 'URL изображения баннера' })
    @IsString()
    @IsNotEmpty({ message: 'URL изображения обязателен' })
    imageUrl: string;

    @ApiPropertyOptional({ description: 'Целевая ссылка при клике на баннер' })
    @IsOptional()
    @IsString()
    targetUrl?: string;
}
