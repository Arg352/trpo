import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class BuyNowDto {
    @ApiProperty({ description: 'ID товара' })
    @IsInt()
    productId: number;

    @ApiPropertyOptional({ description: 'Количество', default: 1, minimum: 1 })
    @IsInt()
    @Min(1)
    @Type(() => Number)
    quantity: number = 1;

    @ApiProperty({
        description: 'Тип доставки',
        enum: ['courier', 'pickup', 'post'],
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['courier', 'pickup', 'post'])
    deliveryType: string;

    @ApiProperty({ description: 'Адрес доставки' })
    @IsString()
    @IsNotEmpty()
    deliveryAddress: string;
}
