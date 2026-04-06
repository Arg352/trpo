import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
    @IsString()
    @IsNotEmpty({ message: 'Город не может быть пустым' })
    city: string;

    @IsString()
    @IsNotEmpty({ message: 'Адрес не может быть пустым' })
    addressText: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
