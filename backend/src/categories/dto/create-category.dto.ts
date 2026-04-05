import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({ description: 'Название категории' })
    @IsString()
    @IsNotEmpty({ message: 'Название категории не может быть пустым' })
    name: string;

    @ApiProperty({ description: 'URL-slug категории' })
    @IsString()
    @IsNotEmpty({ message: 'Slug не может быть пустым' })
    slug: string;

    @ApiProperty({ description: 'URL картинки категории' })
    @IsString()
    @IsNotEmpty({ message: 'URL картинки категории обязателен' })
    imageUrl: string;
}

