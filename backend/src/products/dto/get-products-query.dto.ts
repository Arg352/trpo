import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class GetProductsQueryDto {
    @ApiPropertyOptional({ description: 'Номер страницы', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Кол-во товаров на странице', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @ApiPropertyOptional({ description: 'Поиск по названию' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ description: 'ID категории' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    categoryId?: number;

    @ApiPropertyOptional({ description: 'Минимальная цена' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minPrice?: number;

    @ApiPropertyOptional({ description: 'Максимальная цена' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxPrice?: number;

    @ApiPropertyOptional({ description: 'Только в наличии', example: 'true' })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    inStock?: boolean;

    @ApiPropertyOptional({
        description: 'Сортировка: price, new, popular',
        default: 'new',
        enum: ['price', 'new', 'popular'],
    })
    @IsOptional()
    @IsString()
    @IsIn(['price', 'new', 'popular'])
    sortBy?: string = 'new';

    @ApiPropertyOptional({
        description: 'Направление сортировки',
        default: 'desc',
        enum: ['asc', 'desc'],
    })
    @IsOptional()
    @IsString()
    @IsIn(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc' = 'desc';

    @ApiPropertyOptional({
        description: 'JSON фильтры характеристик, пример: {"Бренд":["Apple"],"Оперативная память":["8 ГБ"]}',
        example: '{"Бренд":["Apple"]}',
    })
    @IsOptional()
    @IsString()
    attributes?: string;

    @ApiPropertyOptional({
        description: 'Только товары со скидкой (oldPrice != null)',
        example: 'true',
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    onDiscount?: boolean;
}
