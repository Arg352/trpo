import { IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CompletePosDto {
    @IsString()
    @IsNotEmpty()
    @Length(10, 10, { message: 'pickupCode должен быть ровно 10 символов' })
    pickupCode: string;

    /**
     * Способ оплаты при выдаче.
     * Передаётся null/undefined если заказ уже оплачен онлайн.
     */
    @IsOptional()
    @IsString()
    @IsIn(['cash', 'card', 'sbp'])
    paymentMethod?: 'cash' | 'card' | 'sbp';
}
