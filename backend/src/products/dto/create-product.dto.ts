import { Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

// Вложенный объект для одной характеристики товара
export class ProductAttributeDto {
    @IsInt({ message: 'attributeId должен быть числом' })
    attributeId: number;

    @IsString()
    @IsNotEmpty({ message: 'Значение атрибута не может быть пустым' })
    value: string;
}

export class CreateProductDto {
    @IsInt({ message: 'categoryId должен быть числом' })
    categoryId: number;

    @IsString()
    @IsNotEmpty({ message: 'Название товара не может быть пустым' })
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNumber({}, { message: 'Цена должна быть числом' })
    @Min(0, { message: 'Цена не может быть отрицательной' })
    price: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    stockQuantity?: number;

    @IsOptional()
    @IsString()
    sku?: string;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    // Массив характеристик: [{ attributeId: 1, value: "8 ГБ" }]
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProductAttributeDto)
    attributes?: ProductAttributeDto[];

    // Массив URL картинок из Cloudinary
    @IsOptional()
    @IsArray()
    @IsString({ each: true, message: 'Каждый URL должен быть строкой' })
    images?: string[];
}
