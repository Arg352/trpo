import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessPaymentDto {
    @ApiProperty({
        description: 'Способ оплаты',
        examples: ['card', 'sbp', 'cash'],
    })
    @IsString()
    @IsNotEmpty({ message: 'Способ оплаты обязателен' })
    paymentMethod: string;
}
