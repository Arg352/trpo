import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CheckoutDto {
    @IsString()
    @IsNotEmpty({ message: 'Адрес доставки не может быть пустым' })
    deliveryAddress: string;

    @IsString()
    @IsIn(['courier', 'pickup', 'post'], {
        message: 'Тип доставки: courier, pickup или post',
    })
    deliveryType: string;

    @IsOptional()
    @IsString()
    comment?: string;

    // Поля доставки — опциональны (не нужны при самовывозе)
    @IsOptional()
    @IsDateString({}, { message: 'deliveryDateFrom должен быть датой в формате ISO 8601' })
    deliveryDateFrom?: string; // "2024-09-24T00:00:00.000Z"

    @IsOptional()
    @IsDateString({}, { message: 'deliveryDateTo должен быть датой в формате ISO 8601' })
    deliveryDateTo?: string;   // "2024-09-30T00:00:00.000Z"

    @IsOptional()
    @IsString()
    deliveryTimeSlot?: string; // "13:00 - 16:00"
}
