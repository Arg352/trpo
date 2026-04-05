import { IsIn, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
    @IsString()
    @IsIn(['new', 'processing', 'shipped', 'delivered', 'cancelled'], {
        message: 'Допустимые статусы: new, processing, shipped, delivered, cancelled',
    })
    status: string;
}
