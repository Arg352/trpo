import { IsInt, IsPositive } from 'class-validator';

export class AddToCartDto {
    @IsInt({ message: 'productId должен быть числом' })
    productId: number;

    @IsInt({ message: 'quantity должен быть числом' })
    @IsPositive({ message: 'quantity должно быть больше 0' })
    quantity: number;
}
