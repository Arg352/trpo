import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPickupDto {
    @ApiProperty({ description: 'ID заказа' })
    @IsInt({ message: 'orderId должен быть числом' })
    orderId: number;

    @ApiProperty({ description: 'Код выдачи (10 символов)', example: '1GWE3W0Q1P' })
    @IsString()
    @IsNotEmpty({ message: 'Код выдачи не может быть пустым' })
    code: string;
}
