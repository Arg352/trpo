import { Type } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

// DTO для создания товара на складе (черновик, isActive: false)
export class CreateInventoryItemDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    sku?: string;

    @IsInt()
    @Min(1)
    @Type(() => Number)
    categoryId: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    stockQuantity?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    minStockLevel?: number = 5;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    price?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    costPrice?: number; // закупочная цена

    @IsOptional()
    @IsString()
    supplier?: string; // поставщик
}
