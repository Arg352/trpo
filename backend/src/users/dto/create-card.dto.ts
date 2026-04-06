import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateCardDto {
    @IsString()
    @IsNotEmpty({ message: 'Название платёжной системы не может быть пустым' })
    brand: string; // "Visa", "Mastercard", "МИР"

    @IsString()
    @Length(4, 4, { message: 'last4Digits должен содержать ровно 4 цифры' })
    last4Digits: string;

    @IsOptional()
    @IsString()
    cardHolder?: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
